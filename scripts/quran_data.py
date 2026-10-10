"""Load the Quran word by word from the cached sources.

Shared by scripts/build.py (which writes the page data) and scripts/query.py
(the reference search engine). Every source is downloaded once into data/raw/.

Sources
  * Quranic Arabic Corpus morphology v0.4 (GPL), mustafa0x fork: word
    segmentation, roots, lemmas and grammatical tags.
  * Tanzil metadata (CC BY 3.0): surahs, revelation order, Madani pages, juz,
    sajdah verses.
  * Tanzil Simple Clean text and the Saheeh International translation.
  * Quran.com API v4: English word-by-word glosses, transliteration and the
    plain (imlaei) spelling of each word.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DERIVED = ROOT / "data" / "derived"

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
QURAN_COM = (
    "https://api.quran.com/api/v4/verses/by_chapter/{chapter}?words=true"
    "&word_fields=text_uthmani,text_imlaei_simple,location&per_page=50&page={page}"
)

ARABIC_MARKS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]")
# Letter variants folded together for searching, so a reader can type plain Arabic.
FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"})


def normalize_ar(text: str) -> str:
    """Strip vowel marks and Quranic annotation signs, fold letter variants."""
    return ARABIC_MARKS.sub("", text).translate(FOLD).replace(" ", "")


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "quran-grid/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def fetch(name: str) -> Path:
    filename, url = SOURCES[name]
    path = RAW / filename
    if not path.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", file=sys.stderr)
        path.write_bytes(_get(url))
    return path


def fetch_quran_com() -> dict[tuple[int, int], dict]:
    """All verses from api.quran.com, keyed by (surah, ayah), cached per page."""
    folder = RAW / "quran.com"
    folder.mkdir(parents=True, exist_ok=True)

    def chapter(n: int) -> list[dict]:
        verses, page = [], 1
        while page:
            path = folder / f"ch{n}_p{page}.json"
            if not path.exists() or path.stat().st_size == 0:
                print(f"downloading quran.com chapter {n} page {page}", file=sys.stderr)
                path.write_bytes(_get(QURAN_COM.format(chapter=n, page=page)))
            data = json.loads(path.read_text(encoding="utf8"))
            verses += data["verses"]
            page = data["pagination"]["next_page"]
        return verses

    out = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for verses in pool.map(chapter, range(1, 115)):
            for v in verses:
                s, a = (int(x) for x in v["verse_key"].split(":"))
                out[(s, a)] = v
    return out


# --------------------------------------------------------------------------- parsers


def parse_metadata(path: Path) -> dict:
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

    def pairs(name: str) -> list[tuple[int, int]]:
        # Lists end with a [115, 1] sentinel marking the end of the Quran.
        return [(int(s), int(a)) for s, a in re.findall(r"\[(\d+), (\d+)", block(name)) if int(s) <= 114]

    meta = {
        "surahs": surahs,
        "pages": pairs("Page"),
        "juz": pairs("Juz"),
        "sajdah": [(int(s), int(a), t) for s, a, t in re.findall(r"\[(\d+), (\d+), '(\w+)'\]", block("Sajda"))],
    }
    if len(surahs) != 114 or len(meta["pages"]) != 604 or len(meta["juz"]) != 30:
        raise SystemExit("metadata: unexpected surah, page or juz count")
    if sorted(s["revelation_order"] for s in surahs) != list(range(1, 115)):
        raise SystemExit("metadata: revelation order is not a permutation of 1..114")
    return meta


def parse_morphology(path: Path) -> dict[tuple[int, int], list[dict]]:
    """{(surah, ayah): [word, ...]}; word = {"text", "segments": [{text, pos, features}]}."""
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
        words[-1]["segments"].append({"text": text, "pos": pos, "features": [f for f in features.split("|") if f]})
    return verses


def parse_tanzil_lines(path: Path) -> dict[tuple[int, int], str]:
    out = {}
    for line in path.read_text(encoding="utf8").splitlines():
        if not line or not line[0].isdigit():
            continue
        s, a, text = line.split("|", 2)
        out[(int(s), int(a))] = text
    return out


def word_record(word: dict) -> dict:
    """Roots, lemmas, the stem's part of speech and every tag of the word."""
    roots, lemmas, tags, stem_pos = [], [], set(), []
    for seg in word["segments"]:
        feats = seg["features"]
        is_affix = "PREF" in feats or "SUFF" in feats
        for f in feats:
            if f.startswith("ROOT:"):
                if f[5:] not in roots:
                    roots.append(f[5:])
            elif f.startswith("LEM:"):
                if not is_affix and f[4:] not in lemmas:
                    lemmas.append(f[4:])
            elif f in ("PREF", "SUFF"):
                continue
            elif ":" in f:
                tags.add(f.split(":")[0])  # VF:1, MOOD:IND -> VF, MOOD
            else:
                tags.add(f)
        if not is_affix:
            stem_pos.append(seg["pos"])
    return {"roots": roots, "lemmas": lemmas, "tags": sorted(tags), "pos": stem_pos[0] if stem_pos else word["segments"][0]["pos"]}


def load() -> dict:
    """Everything, verse by verse in mushaf order."""
    meta = parse_metadata(fetch("metadata"))
    morph = parse_morphology(fetch("morphology"))
    translation = parse_tanzil_lines(fetch("translation"))
    qc = fetch_quran_com()

    order = [(s["n"], a) for s in meta["surahs"] for a in range(1, s["verses"] + 1)]
    if sorted(morph) != order or sorted(translation) != order or sorted(qc) != order:
        raise SystemExit("sources disagree on the list of 6,236 verses")
    verse_index = {key: i for i, key in enumerate(order)}

    def starts(pairs):
        return [verse_index[p[:2]] for p in pairs]

    page_start = starts(meta["pages"])
    juz_start = starts(meta["juz"])
    sajdah = {verse_index[(s, a)]: t for s, a, t in meta["sajdah"]}

    verses, words = [], []
    for vi, key in enumerate(order):
        mwords = morph[key]
        qwords = [w for w in qc[key]["words"] if w["char_type_name"] == "word"]
        if len(qwords) != len(mwords):
            raise SystemExit(f"word counts differ at {key}: corpus {len(mwords)}, quran.com {len(qwords)}")
        verses.append(
            {
                "surah": key[0],
                "ayah": key[1],
                "first_word": len(words),
                "words": len(mwords),
                "juz": sum(1 for j in juz_start if j <= vi),
                "page": sum(1 for p in page_start if p <= vi),
                "sajdah": sajdah.get(vi),
                "en": translation[key],
            }
        )
        for i, (mw, qw) in enumerate(zip(mwords, qwords), start=1):
            rec = word_record(mw)
            words.append(
                {
                    "surah": key[0],
                    "ayah": key[1],
                    "word": i,
                    "verse": vi,
                    "ar": mw["text"],
                    # Drop the section (۞) and prostration (۩) signs printed inside some words.
                    "plain": re.sub(r"[\u06DE\u06E9]", "", qw["text_imlaei_simple"]).strip(),
                    "translit": (qw.get("transliteration") or {}).get("text") or "",
                    "gloss": (qw.get("translation") or {}).get("text") or "",
                    **rec,
                }
            )
    return {"surahs": meta["surahs"], "verses": verses, "words": words, "page_start": page_start, "juz_start": juz_start}


def load_derived() -> dict:
    """The dataset written by scripts/build.py (fast path for scripts/query.py)."""
    path = DERIVED / "quran_words.json"
    if not path.exists():
        raise SystemExit("data/derived/quran_words.json is missing: run python3 scripts/build.py first")
    return json.loads(path.read_text(encoding="utf8"))
