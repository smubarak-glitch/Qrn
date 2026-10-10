#!/usr/bin/env python3
"""Build everything behind the Quran grid explorer.

  1. Loads the Quran word by word (scripts/quran_data.py; sources cached in
     data/raw/) and writes data/derived/quran_words.json for scripts/query.py.
  2. Month study: finds every word from the root ش ه ر, cross-checks the list
     against a spelling search of the Tanzil text, and writes
     data/month_occurrences.{json,csv} and docs/month-grid-*.svg.
  3. Checks every discovery in data/discoveries.json against the reference
     query engine (each stated count must match).
  4. Packs the page data (gzip + base64) into index.html between the DATA
     markers, so the page works opened straight from disk.

Standard library only. Run from anywhere:  python3 scripts/build.py
"""

from __future__ import annotations

import base64
import csv
import gzip
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import quran_data  # noqa: E402
from quran_data import DERIVED, ROOT, normalize_ar  # noqa: E402

MONTH_ROOT = "شهر"
MONTH_SPELLING = re.compile("شهو?ر")
BASMALA = "بسم الله الرحمن الرحيم"
DATA_BEGIN = "<!-- DATA:BEGIN -->"
DATA_END = "<!-- DATA:END -->"
APP_BEGIN = "<!-- APP:BEGIN -->"
APP_END = "<!-- APP:END -->"

# Word shapes of the root. "form" is the grammatical number; both plurals occur.
FORMS = {
    "shahr": {"form": "singular", "translit": "shahr", "gloss": "month"},
    "shahrayn": {"form": "dual", "translit": "shahrayn", "gloss": "two months"},
    "ashhur": {"form": "plural", "translit": "ashhur", "gloss": "months"},
    "shuhur": {"form": "plural", "translit": "shuhūr", "gloss": "months"},
}


# --------------------------------------------------------------------------- month study


def month_key(word: dict) -> str:
    tags = set(word["tags"])
    if tags & {"MD", "FD"}:
        return "shahrayn"
    if tags & {"MP", "FP"}:
        bare = normalize_ar(word["ar"])
        if "شهور" in bare:
            return "shuhur"
        if "اشهر" in bare:
            return "ashhur"
        raise SystemExit(f"unrecognised plural of shahr: {word['ar']}")
    return "shahr"


def month_study(data: dict) -> dict:
    words, verses = data["words"], data["verses"]
    found = [w for w in words if MONTH_ROOT in w["roots"]]

    # Independent check: spelling search of the Tanzil text, basmala prefixes removed.
    plain = quran_data.parse_tanzil_lines(quran_data.fetch("text"))
    by_root: dict[tuple[int, int], int] = {}
    for w in found:
        by_root[(w["surah"], w["ayah"])] = by_root.get((w["surah"], w["ayah"]), 0) + 1
    by_text: dict[tuple[int, int], int] = {}
    for (s, a), text in plain.items():
        if a == 1 and s not in (1, 9) and text.startswith(BASMALA + " "):
            text = text[len(BASMALA) + 1:]
        n = sum(bool(MONTH_SPELLING.search(tok)) for tok in text.split())
        if n:
            by_text[(s, a)] = n
    if by_root != by_text:
        raise SystemExit(f"month cross-check failed:\n root: {by_root}\n text: {by_text}")

    page_start = data["page_start"]
    occurrences = []
    for i, w in enumerate(found, start=1):
        key = month_key(w)
        v = w["verse"]
        occurrences.append(
            {
                "n": i,
                "ref": f"{w['surah']}:{w['ayah']}",
                "surah": w["surah"],
                "ayah": w["ayah"],
                "word": w["word"],
                "verse_index": v,
                "word_index": verses[v]["first_word"] + w["word"] - 1,
                "page": sum(1 for p in page_start if p <= v),
                "key": key,
                "form": FORMS[key]["form"],
                "translit": FORMS[key]["translit"],
                "gloss": FORMS[key]["gloss"],
                "arabic": w["ar"],
            }
        )
    month_verses = []
    for o in occurrences:
        if month_verses and month_verses[-1]["ref"] == o["ref"]:
            continue
        v = verses[o["verse_index"]]
        month_verses.append(
            {
                "ref": o["ref"],
                "surah": o["surah"],
                "ayah": o["ayah"],
                "words": [w["ar"] for w in words[v["first_word"]:v["first_word"] + v["words"]]],
                "translation": v["en"],
            }
        )
    summary = {
        "root": MONTH_ROOT,
        "occurrences": len(occurrences),
        "verses": len(month_verses),
        "surahs": len({o["surah"] for o in occurrences}),
        "by_form": {f: sum(o["form"] == f for o in occurrences) for f in ("singular", "dual", "plural")},
        "by_word": {k: sum(o["key"] == k for o in occurrences) for k in FORMS},
        "total_words": len(words),
        "total_verses": len(verses),
        "total_pages": len(page_start),
    }
    return {"summary": summary, "occurrences": occurrences, "verses": month_verses}


def grid_shape(n: int) -> tuple[int, int]:
    cols = math.ceil(math.sqrt(n))
    return cols, math.ceil(n / cols)


def render_svg(path: Path, n: int, positions: list[int], label: str, rtl: bool = True) -> None:
    """Black square grid, one white dot per occupied cell (reading order: top-right
    start for rtl). Dots that share a cell or touch are grouped, and a group with
    more than one mention gets a ring."""
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

    dots = []
    for p, c in sorted(counts.items()):
        row, col = divmod(p, cols)
        if rtl:
            col = cols - 1 - col
        dots.append((pad + (col + 0.5) * cell, pad + (row + 0.5) * cell, c))

    # Group dots closer than their own width (same rule as index.html).
    parent = list(range(len(dots)))

    def find(i: int) -> int:
        while parent[i] != i:
            i = parent[i]
        return i

    for i in range(len(dots)):
        for j in range(i + 1, len(dots)):
            if math.dist(dots[i][:2], dots[j][:2]) < 2 * r + 1:
                parent[find(j)] = find(i)
    groups: dict[int, list[tuple[float, float, int]]] = {}
    for i, d in enumerate(dots):
        groups.setdefault(find(i), []).append(d)

    for cx, cy, _ in dots:
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 3:.1f}" fill="url(#g)"/>')
    for cx, cy, _ in dots:
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="#fff"/>')
    for members in groups.values():
        if sum(c for _, _, c in members) < 2:
            continue
        gx = sum(x for x, _, _ in members) / len(members)
        gy = sum(y for _, y, _ in members) / len(members)
        spread = max(math.dist((gx, gy), (x, y)) for x, y, _ in members)
        parts.append(
            f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="{spread + r + 3.5:.1f}" fill="none" '
            'stroke="#fff" stroke-width="1.5"/>'
        )
    parts.append(
        f'<text x="{pad}" y="{height - 22:.0f}" fill="#8c8a86" '
        f'font-family="IBM Plex Mono, ui-monospace, monospace" font-size="15">{label}</text>'
    )
    parts.append("</svg>")
    path.write_text("\n".join(parts) + "\n", encoding="utf8")


def write_month_outputs(month: dict) -> None:
    data_dir = ROOT / "data"
    (data_dir / "month_occurrences.json").write_text(
        json.dumps(month, ensure_ascii=False, indent=1) + "\n", encoding="utf8"
    )
    with open(data_dir / "month_occurrences.csv", "w", newline="", encoding="utf8") as fh:
        cols = ["n", "ref", "surah", "ayah", "word", "page", "word_index", "verse_index",
                "form", "translit", "gloss", "arabic"]
        writer = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(month["occurrences"])

    s = month["summary"]
    docs = ROOT / "docs"
    docs.mkdir(exist_ok=True)
    for unit, n, positions in (
        ("words", s["total_words"], [o["word_index"] for o in month["occurrences"]]),
        ("verses", s["total_verses"], [o["verse_index"] for o in month["occurrences"]]),
        ("pages", s["total_pages"], [o["page"] - 1 for o in month["occurrences"]]),
    ):
        cols, rows = grid_shape(n)
        render_svg(
            docs / f"month-grid-{unit}.svg",
            n,
            positions,
            f"{n:,} {unit} · {cols} x {rows} grid · read right to left from the top · "
            f"{s['occurrences']} mentions of month",
        )


# --------------------------------------------------------------------------- discoveries


def check_discoveries() -> list[dict]:
    """Every discovery's stated counts must match the reference engine."""
    path = ROOT / "data" / "discoveries.json"
    if not path.exists():
        return []
    import query  # needs data/derived/quran_words.json, written above

    query.dataset.cache_clear()
    items = json.loads(path.read_text(encoding="utf8"))
    ids = set()
    problems = []
    for item in items:
        if item["id"] in ids:
            problems.append(f"{item['id']}: duplicate id")
        ids.add(item["id"])
        if not re.fullmatch(r"[a-z0-9-]+", item["id"]):
            problems.append(f"{item['id']}: id must be lowercase letters, digits and dashes")
        for series in item["series"]:
            try:
                got = query.summarize(series["q"], limit=0)
            except query.QueryError as e:
                problems.append(f"{item['id']}: {series['q']}: {e}")
                continue
            if "count" in series and series["count"] != got["count"]:
                problems.append(f"{item['id']}: {series['q']} states {series['count']}, engine finds {got['count']}")
    if problems:
        raise SystemExit("discoveries.json does not match the data:\n  " + "\n  ".join(problems))
    return items


# --------------------------------------------------------------------------- page data


def page_payload(data: dict, discoveries: list[dict]) -> dict:
    words, verses = data["words"], data["verses"]
    roots = sorted({r for w in words for r in w["roots"]})
    lemmas = sorted({x for w in words for x in w["lemmas"]})
    tagsets = sorted({" ".join(w["tags"]) for w in words})
    root_id = {r: i for i, r in enumerate(roots)}
    lemma_id = {x: i for i, x in enumerate(lemmas)}
    tag_id = {t: i for i, t in enumerate(tagsets)}

    extra_roots, extra_lemmas = [], []
    for i, w in enumerate(words):
        extra_roots += [[i, root_id[r]] for r in w["roots"][1:]]
        extra_lemmas += [[i, lemma_id[x]] for x in w["lemmas"][1:]]

    return {
        "surahs": [
            [s["name"], s["name_ar"], s["name_en"], s["verses"], s["revelation_order"], s["type"]]
            for s in data["surahs"]
        ],
        "verse_words": [v["words"] for v in verses],
        "verse_en": [v["en"] for v in verses],
        "page_start": data["page_start"],
        "juz_start": data["juz_start"],
        "sajdah": [[i, v["sajdah"]] for i, v in enumerate(verses) if v["sajdah"]],
        "roots": roots,
        "lemmas": lemmas,
        "tagsets": tagsets,
        "w_ar": [w["ar"] for w in words],
        "w_plain": [w["plain"] for w in words],
        "w_translit": [w["translit"] for w in words],
        "w_gloss": [w["gloss"] for w in words],
        "w_pos": "".join(w["pos"] for w in words),
        "w_root": [root_id[w["roots"][0]] if w["roots"] else -1 for w in words],
        "w_lemma": [lemma_id[w["lemmas"][0]] if w["lemmas"] else -1 for w in words],
        "w_tags": [tag_id[" ".join(w["tags"])] for w in words],
        "extra_roots": extra_roots,
        "extra_lemmas": extra_lemmas,
        "discoveries": discoveries,
    }


def replace_between(html: str, begin: str, end: str, content: str) -> str:
    a, b = html.find(begin), html.find(end)
    if a < 0 or b < a:
        raise SystemExit(f"index.html: markers {begin} ... {end} not found")
    return html[: a + len(begin)] + "\n" + content + "\n" + html[b:]


def inject(payload: dict) -> int:
    """Inline the packed data and src/explorer.js, so index.html is one self-contained file."""
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    # mtime=0 keeps the output byte-identical between builds.
    packed = base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode("ascii")
    app = (ROOT / "src" / "explorer.js").read_text(encoding="utf8")
    if "</script" in app:
        raise SystemExit("src/explorer.js must not contain </script")
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf8")
    html = replace_between(
        html, DATA_BEGIN, DATA_END, f'<script id="quran-data" type="application/gzip-base64">{packed}</script>'
    )
    html = replace_between(html, APP_BEGIN, APP_END, f"<script>\n{app}</script>")
    index.write_text(html, encoding="utf8")
    return len(packed)


def main() -> None:
    data = quran_data.load()
    DERIVED.mkdir(parents=True, exist_ok=True)
    (DERIVED / "quran_words.json").write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf8"
    )

    month = month_study(data)
    write_month_outputs(month)
    discoveries = check_discoveries()

    if "--no-page" not in sys.argv:
        size = inject(page_payload(data, discoveries))
        print(f"index.html data: {size / 1e6:.2f} MB packed, {len(discoveries)} discoveries", file=sys.stderr)
    print(json.dumps(month["summary"], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
