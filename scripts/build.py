#!/usr/bin/env python3
"""Build the data behind the Quran month grid.

Downloads (and caches in data/raw/) the word-by-word morphology of the Quran,
the Tanzil metadata (surahs, Madani mushaf pages), the Tanzil Simple Clean text
and the Saheeh International translation, then:

  * finds every word whose root is ش ه ر (sh-h-r, "month"),
  * cross-checks that list against a plain-text search of the Tanzil text,
  * writes data/*.json + data/month_occurrences.csv,
  * injects the data into index.html between the DATA markers,
  * renders docs/month-grid-{words,verses,pages}.svg.

Standard library only. Run from anywhere:  python3 scripts/build.py
"""

from __future__ import annotations

import csv
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

MORPHOLOGY_COMMIT = "8f38b39016824284f9ed16ae15069ff9102c4acf"
SOURCES = {
    "morphology": (
        "quran-morphology.txt",
        "https://raw.githubusercontent.com/mustafa0x/quran-morphology/"
        f"{MORPHOLOGY_COMMIT}/quran-morphology.txt",
    ),
    "metadata": ("quran-data.js", "https://tanzil.net/res/text/metadata/quran-data.js"),
    "text": (
        "quran-simple-clean.txt",
        "https://tanzil.net/pub/download/index.php?quranType=simple-clean&outType=txt-2&agree=true",
    ),
    "translation": ("en.sahih.txt", "https://tanzil.net/trans/?transID=en.sahih&type=txt-2"),
}

MONTH_ROOT = "شهر"
MONTH_SPELLING = re.compile("شهو?ر")
BASMALA = "بسم الله الرحمن الرحيم"
DATA_BEGIN = "<!-- DATA:BEGIN -->"
DATA_END = "<!-- DATA:END -->"

# Lemma-level forms of the root. "form" is the grammatical number; "key" the
# specific word shape (both plurals of shahr occur).
FORMS = {
    "shahr": {"form": "singular", "translit": "shahr", "gloss": "month"},
    "shahrayn": {"form": "dual", "translit": "shahrayn", "gloss": "two months"},
    "ashhur": {"form": "plural", "translit": "ashhur", "gloss": "months"},
    "shuhur": {"form": "plural", "translit": "shuhūr", "gloss": "months"},
}

ARABIC_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def fetch(name: str) -> Path:
    filename, url = SOURCES[name]
    path = RAW / filename
    if not path.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", file=sys.stderr)
        req = urllib.request.Request(url, headers={"User-Agent": "quran-month-grid/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            path.write_bytes(resp.read())
    return path


def strip_diacritics(text: str) -> str:
    text = ARABIC_DIACRITICS.sub("", text)
    return text.replace("ٱ", "ا")


# --------------------------------------------------------------------------- parsing


def parse_metadata(path: Path):
    js = path.read_text(encoding="utf8")

    def block(name: str) -> str:
        m = re.search(rf"QuranData\.{name} = \[(.*?)\n\];", js, re.S)
        if not m:
            raise SystemExit(f"metadata: QuranData.{name} not found")
        return m.group(1)

    surahs = []
    row = re.compile(
        r"\[(\d+), (\d+), (\d+), (\d+), '([^']*)', \"([^\"]*)\", '((?:[^'\\]|\\.)*)', '(\w+)'\]"
    )
    for m in row.finditer(block("Sura")):
        start, ayas, order, _rukus, name, tname, ename, kind = m.groups()
        surahs.append(
            {
                "n": len(surahs) + 1,
                "name_ar": name,
                "name": tname,
                "name_en": ename.replace("\\'", "'"),
                "verses": int(ayas),
                "first_verse": int(start),
                "revelation_order": int(order),
                "type": kind,
            }
        )
    # The list ends with a [115, 1] sentinel marking the end of the last page.
    pages = [(int(s), int(a)) for s, a in re.findall(r"\[(\d+), (\d+)\]", block("Page")) if int(s) <= 114]
    if len(surahs) != 114 or len(pages) != 604:
        raise SystemExit(f"metadata: expected 114 surahs and 604 pages, got {len(surahs)}, {len(pages)}")
    if sorted(s["revelation_order"] for s in surahs) != list(range(1, 115)):
        raise SystemExit("metadata: revelation order is not a permutation of 1..114")
    return surahs, pages


def parse_morphology(path: Path):
    """Return {(surah, ayah): [word, ...]} where word = {"text", "segments"}."""
    verses: dict[tuple[int, int], list[dict]] = {}
    for line in path.read_text(encoding="utf8").splitlines():
        if not line or not line[0].isdigit():
            continue
        loc, text, pos, features = line.split("\t")
        s, a, w, _seg = (int(x) for x in loc.split(":"))
        words = verses.setdefault((s, a), [])
        if w == len(words) + 1:
            words.append({"text": "", "segments": []})
        elif w != len(words):
            raise SystemExit(f"morphology: word numbering jumps at {loc}")
        words[-1]["text"] += text
        words[-1]["segments"].append({"text": text, "pos": pos, "features": features.split("|")})
    return verses


def parse_tanzil_lines(path: Path) -> dict[tuple[int, int], str]:
    out = {}
    for line in path.read_text(encoding="utf8").splitlines():
        if not line or not line[0].isdigit():
            continue
        s, a, text = line.split("|", 2)
        out[(int(s), int(a))] = text
    return out


# --------------------------------------------------------------------------- analysis


def classify(segment: dict, word_text: str) -> str:
    feats = set(segment["features"])
    if feats & {"MD", "FD", "D"}:
        return "shahrayn"
    if feats & {"MP", "FP", "P"}:
        bare = strip_diacritics(word_text)
        if "شهور" in bare:
            return "shuhur"
        if "أشهر" in bare or "اشهر" in bare:
            return "ashhur"
        raise SystemExit(f"unrecognised plural of shahr: {word_text}")
    return "shahr"


def find_month_words(verses):
    found = []
    for (s, a), words in verses.items():
        for w, word in enumerate(words, start=1):
            for seg in word["segments"]:
                if f"ROOT:{MONTH_ROOT}" in seg["features"]:
                    found.append({"surah": s, "ayah": a, "word": w, "key": classify(seg, word["text"])})
    return found


def cross_check(found, verses, plain_text) -> None:
    """Independent check: count space-separated tokens in the Tanzil Simple Clean
    text (basmala prefixes removed) that spell ش-ه-ر, allowing the و of the
    plural shuhur (شهور), and compare per verse with the root search."""
    by_root: dict[tuple[int, int], int] = {}
    for f in found:
        by_root[(f["surah"], f["ayah"])] = by_root.get((f["surah"], f["ayah"]), 0) + 1

    by_text: dict[tuple[int, int], int] = {}
    for (s, a), text in plain_text.items():
        if a == 1 and s not in (1, 9) and text.startswith(BASMALA + " "):
            text = text[len(BASMALA) + 1 :]
        n = sum(bool(MONTH_SPELLING.search(tok)) for tok in text.split())
        if n:
            by_text[(s, a)] = n

    if by_root != by_text:
        raise SystemExit(f"cross-check failed:\n root search: {by_root}\n text search: {by_text}")
    if len(plain_text) != len(verses):
        raise SystemExit("cross-check failed: verse counts differ between sources")


# --------------------------------------------------------------------------- output


def grid_shape(n: int) -> tuple[int, int]:
    cols = math.ceil(math.sqrt(n))
    return cols, math.ceil(n / cols)


def render_svg(path: Path, n: int, positions: list[int], label: str, rtl: bool = True) -> None:
    """Black square grid, one white dot per occupied cell (reading order: top-right
    start for rtl). Counts > 1 in the same cell get a ring."""
    cols, rows = grid_shape(n)
    size = 1000
    pad = 40
    cell = (size - 2 * pad) / max(cols, rows)
    width = cols * cell + 2 * pad
    height = rows * cell + 2 * pad + 36
    r = max(cell * 0.42, 5.5)

    counts: dict[int, int] = {}
    for p in positions:
        counts[p] = counts.get(p, 0) + 1

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" '
        f'width="{width:.0f}" height="{height:.0f}">',
        '<defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity=".35"/>'
        '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>',
        '<rect width="100%" height="100%" fill="#000"/>',
        # Filled squares: every full row, then the part of the last row in use.
        f'<rect x="{pad:.1f}" y="{pad:.1f}" width="{cols * cell:.1f}" '
        f'height="{(rows - 1) * cell:.1f}" fill="#141412"/>',
    ]
    last = n - (rows - 1) * cols
    last_x = pad + (cols - last) * cell if rtl else pad
    parts.append(
        f'<rect x="{last_x:.1f}" y="{pad + (rows - 1) * cell:.1f}" width="{last * cell:.1f}" '
        f'height="{cell:.1f}" fill="#141412"/>'
    )
    for p, c in sorted(counts.items()):
        row, col = divmod(p, cols)
        if rtl:
            col = cols - 1 - col
        cx = pad + (col + 0.5) * cell
        cy = pad + (row + 0.5) * cell
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 3:.1f}" fill="url(#g)"/>')
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="#fff"/>')
        if c > 1:
            parts.append(
                f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r + 3.5:.1f}" fill="none" '
                'stroke="#fff" stroke-width="1.5"/>'
            )
    parts.append(
        f'<text x="{pad}" y="{height - 22:.0f}" fill="#8c8a86" '
        f'font-family="IBM Plex Mono, ui-monospace, monospace" font-size="15">{label}</text>'
    )
    parts.append("</svg>")
    path.write_text("\n".join(parts) + "\n", encoding="utf8")


def main() -> None:
    surahs, pages = parse_metadata(fetch("metadata"))
    verses = parse_morphology(fetch("morphology"))
    plain_text = parse_tanzil_lines(fetch("text"))
    translation = parse_tanzil_lines(fetch("translation"))

    # Order verses the mushaf way and check them against the metadata.
    order = [(s["n"], a) for s in surahs for a in range(1, s["verses"] + 1)]
    if sorted(verses) != order:
        raise SystemExit("morphology verses do not match the 6,236 verses in the metadata")
    verse_index = {key: i for i, key in enumerate(order)}
    verse_word_counts = [len(verses[key]) for key in order]
    word_start = [0]
    for c in verse_word_counts:
        word_start.append(word_start[-1] + c)
    total_words = word_start[-1]

    page_start_verse = [verse_index[p] for p in pages]
    if page_start_verse != sorted(page_start_verse) or page_start_verse[0] != 0:
        raise SystemExit("page starts are not increasing")

    found = find_month_words(verses)
    found.sort(key=lambda f: (verse_index[(f["surah"], f["ayah"])], f["word"]))
    cross_check(found, verses, plain_text)

    occurrences = []
    for i, f in enumerate(found, start=1):
        key = (f["surah"], f["ayah"])
        v = verse_index[key]
        page = next(p for p in range(len(page_start_verse) - 1, -1, -1) if page_start_verse[p] <= v) + 1
        words = verses[key]
        occurrences.append(
            {
                "n": i,
                "ref": f"{f['surah']}:{f['ayah']}",
                "surah": f["surah"],
                "ayah": f["ayah"],
                "word": f["word"],
                "verse_index": v,
                "word_index": word_start[v] + f["word"] - 1,
                "page": page,
                "key": f["key"],
                "form": FORMS[f["key"]]["form"],
                "translit": FORMS[f["key"]]["translit"],
                "gloss": FORMS[f["key"]]["gloss"],
                "arabic": words[f["word"] - 1]["text"],
            }
        )

    month_verses = {}
    for o in occurrences:
        key = (o["surah"], o["ayah"])
        if key not in month_verses:
            month_verses[key] = {
                "ref": o["ref"],
                "surah": o["surah"],
                "ayah": o["ayah"],
                "words": [w["text"] for w in verses[key]],
                "translation": translation[key],
            }

    by_key = {k: sum(o["key"] == k for o in occurrences) for k in FORMS}
    by_form = {
        f: sum(o["form"] == f for o in occurrences) for f in ("singular", "dual", "plural")
    }
    summary = {
        "root": MONTH_ROOT,
        "occurrences": len(occurrences),
        "verses": len(month_verses),
        "surahs": len({o["surah"] for o in occurrences}),
        "by_form": by_form,
        "by_word": by_key,
        "total_words": total_words,
        "total_verses": len(order),
        "total_pages": len(pages),
    }

    structure = {
        "surahs": surahs,
        "verse_word_counts": verse_word_counts,
        "page_start_verse": page_start_verse,
    }

    data_dir = ROOT / "data"
    (data_dir / "quran_structure.json").write_text(
        json.dumps(structure, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8"
    )
    (data_dir / "month_occurrences.json").write_text(
        json.dumps(
            {"summary": summary, "occurrences": occurrences, "verses": list(month_verses.values())},
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf8",
    )
    with open(data_dir / "month_occurrences.csv", "w", newline="", encoding="utf8") as fh:
        cols = ["n", "ref", "surah", "ayah", "word", "page", "word_index", "verse_index",
                "form", "translit", "gloss", "arabic"]
        writer = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(occurrences)

    # Inline everything the page needs, so index.html works opened straight from disk.
    payload = {
        "summary": summary,
        "occurrences": occurrences,
        "verses": list(month_verses.values()),
        "surahs": [
            {k: s[k] for k in ("n", "name", "name_ar", "name_en", "verses", "revelation_order", "type")}
            for s in surahs
        ],
        "verse_word_counts": verse_word_counts,
        "page_start_verse": page_start_verse,
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf8")
    start, end = html.find(DATA_BEGIN), html.find(DATA_END)
    if start < 0 or end < start:
        raise SystemExit("index.html: DATA markers not found")
    html = (
        html[: start + len(DATA_BEGIN)]
        + f'\n<script id="quran-data" type="application/json">{blob}</script>\n'
        + html[end:]
    )
    index.write_text(html, encoding="utf8")

    docs = ROOT / "docs"
    docs.mkdir(exist_ok=True)
    for unit, n, positions in (
        ("words", total_words, [o["word_index"] for o in occurrences]),
        ("verses", len(order), [o["verse_index"] for o in occurrences]),
        ("pages", len(pages), [o["page"] - 1 for o in occurrences]),
    ):
        cols, rows = grid_shape(n)
        render_svg(
            docs / f"month-grid-{unit}.svg",
            n,
            positions,
            f"{n:,} {unit} · {cols} x {rows} grid · read right to left from the top · "
            f"{len(occurrences)} mentions of month",
        )

    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
