#!/usr/bin/env python3
"""Reference search engine for the Quran grid explorer.

The page (src/explorer.js) implements the same query language in JavaScript;
this module is the specification and is used to check every discovery's
numbers. Change the two together.

Query language
  A query is one or more groups separated by "|" (OR). A group is terms
  separated by spaces (AND). A term is key:value; values may be quoted
  (en:"the sun") and may list alternatives with commas (root:شمس,قمر).
  A leading "-" negates a term (-tag:PN). Arabic-Indic digits work like 0-9.

  Word keys    root:  lemma: (diacritics ignored; lemma:=x matches the vowelled
               dictionary form exactly)  ar: (spelling contains; ar:=x exact)
               en: (word-by-word English, whole words, * wildcard)
               pos: N|V|P   tag: corpus tag (PN, ADJ, DET, MP, INL, NEG, ...)
               at: first|last (position of the word in its verse)
  Verse keys   tr: (Saheeh International translation)   surah:  juz:  page:
               ref: (2:255, 2:255-257)   type: meccan|medinan   sajdah:yes|no
               has:"<word term>" (the verse contains such a word, e.g.
               has:"root:شمس" has:"root:قمر" = verses with both sun and moon)

  A bare Arabic word is a root if it is one, else ar:. Bare Latin text is en:.
  A bare reference like 2:255 is ref:.

  Arabic is compared without vowel marks, with أ إ آ ٱ as ا, ى and ئ as ي,
  ؤ as و, ة as ه, and the Uthmani ءا as ا. ar: matches both the plain spelling
  and the Uthmani spelling of each word. English is compared in lower case with
  the translators' brackets removed.

  A group with any word key returns words; a group with only verse keys
  returns verses. When groups of both kinds are OR-ed, words become verses.

CLI
  python3 scripts/query.py 'root:شهر'
  python3 scripts/query.py --json 'en:sun | en:moon'
"""

from __future__ import annotations

import json
import re
import sys
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quran_data import load_derived, normalize_ar  # noqa: E402

WORD_KEYS = {"root", "lemma", "ar", "en", "pos", "tag", "at"}
VERSE_KEYS = {"tr", "surah", "juz", "page", "ref", "type", "sajdah", "has"}
# ASCII classes throughout, so Python and JavaScript read a query the same way.
TOKEN = re.compile(r'(-?)(?:(\w+):"([^"]*)"|(\w+):(\S+)|"([^"]*)"|(\S+))', re.ASCII)
ARABIC = re.compile("[\u0600-\u06FF]")
REF = re.compile(r"^[0-9]+:[0-9]+(-[0-9]+)?$")
SPACE = re.compile("[\\s\uFEFF]")
DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "0123456789" * 2)
FORMAT = re.compile("[\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]")
WORDCHAR = "[A-Za-z0-9_]"
MAX_WILDCARDS = 4


class QueryError(ValueError):
    pass


# --------------------------------------------------------------------------- data


@lru_cache(maxsize=1)
def dataset() -> dict:
    d = load_derived()
    words = d["words"]
    d["_word_roots"] = [[normalize_ar(r) for r in w["roots"]] for w in words]
    d["_word_lemmas"] = [[normalize_ar(x) for x in w["lemmas"]] for w in words]
    d["_word_lemmas_exact"] = [[FORMAT.sub("", x) for x in w["lemmas"]] for w in words]
    d["_word_plain"] = [normalize_ar(w["plain"]) for w in words]
    d["_word_uthmani"] = [normalize_ar(w["ar"]) for w in words]
    d["_word_gloss"] = [clean_english(w["gloss"]) for w in words]
    d["_verse_en"] = [clean_english(v["en"]) for v in d["verses"]]
    d["_roots"] = {r for rs in d["_word_roots"] for r in rs}
    d["_surah_type"] = {s["n"]: s["type"].lower() for s in d["surahs"]}
    return d


def clean_english(text: str) -> str:
    """Lowercase, drop the brackets translators use for implied words."""
    return re.sub(r"[()\[\]]", "", text.lower())


def phrase_regex(value: str) -> re.Pattern:
    words = clean_english(value).split(" ")
    words = [re.sub(r"\*+", "*", w) for w in words if w]
    if not words:
        raise QueryError("empty English phrase")
    if sum(w.count("*") for w in words) > MAX_WILDCARDS:
        raise QueryError(f"use at most {MAX_WILDCARDS} * wildcards in one phrase")
    parts = [re.escape(w).replace(r"\*", WORDCHAR + "*") for w in words]
    return re.compile(f"(?<!{WORDCHAR})" + " +".join(parts) + f"(?!{WORDCHAR})")


def number_ranges(value: str, key: str) -> list[tuple[int, int]]:
    out = []
    for part in value.split(","):
        m = re.fullmatch(r"([0-9]{1,6})(?:-([0-9]{1,6}))?", part.strip())
        if not m:
            raise QueryError(f"{key}: expects numbers or ranges like 1-10, got {part!r}")
        out.append((int(m.group(1)), int(m.group(2) or m.group(1))))
    return out


# --------------------------------------------------------------------------- parsing


def canonical(query: str) -> str:
    """One kind of space, ASCII digits."""
    return SPACE.sub(" ", query).translate(DIGITS)


def parse(query: str) -> list[list[tuple[bool, str, str]]]:
    """[[(negated, key, value), ...], ...] — OR of AND-groups."""
    groups = []
    for raw in canonical(query).split("|"):
        if not raw.strip():
            continue
        terms = []
        for m in TOKEN.finditer(raw):
            neg = m.group(1) == "-"
            if m.group(2):
                key, value = m.group(2).lower(), m.group(3)
            elif m.group(4) and re.fullmatch(r"[0-9]+", m.group(4)):
                key, value = "ref", f"{m.group(4)}:{m.group(5)}"
            elif m.group(4):
                key, value = m.group(4).lower(), m.group(5)
            elif m.group(6) is not None:
                key, value = "en", m.group(6)
            else:
                key, value = bare_key(m.group(7)), m.group(7)
            if key not in WORD_KEYS | VERSE_KEYS:
                raise QueryError(f"unknown key {key!r}")
            terms.append((neg, key, value))
        if terms:
            groups.append(terms)
    if not groups:
        raise QueryError("empty query")
    return groups


def bare_key(token: str) -> str:
    if REF.match(token):
        return "ref"
    if ARABIC.search(token):
        return "root" if normalize_ar(token) in dataset()["_roots"] else "ar"
    return "en"


# --------------------------------------------------------------------------- matching


def alternatives(key: str, value: str) -> list[str]:
    alts = [v.strip() for v in value.split(",") if v.strip()]
    if not alts:
        raise QueryError(f"{key}: empty value")
    return alts


def word_test(key: str, value: str):
    d = dataset()
    words = d["words"]
    alts = alternatives(key, value)
    if key == "root":
        want = {normalize_ar(v) for v in alts}
        return lambda i: any(r in want for r in d["_word_roots"][i])
    if key == "lemma":
        exact = {FORMAT.sub("", v[1:]) for v in alts if v.startswith("=")}
        loose = {normalize_ar(v) for v in alts if not v.startswith("=")}
        return lambda i: (any(x in exact for x in d["_word_lemmas_exact"][i])
                          or any(x in loose for x in d["_word_lemmas"][i]))
    if key == "ar":
        exact = {normalize_ar(v[1:]) for v in alts if v.startswith("=")}
        contains = [c for c in (normalize_ar(v) for v in alts if not v.startswith("=")) if c]

        def ar(i):
            p, u = d["_word_plain"][i], d["_word_uthmani"][i]
            return p in exact or u in exact or any(c in p or c in u for c in contains)

        return ar
    if key == "en":
        rxs = [phrase_regex(v) for v in alts]
        return lambda i: any(rx.search(d["_word_gloss"][i]) for rx in rxs)
    if key == "pos":
        want = {v.upper() for v in alts}
        if not want <= {"N", "V", "P"}:
            raise QueryError("pos: expects N, V or P")
        return lambda i: words[i]["pos"] in want
    if key == "tag":
        want = {v.upper() for v in alts}
        return lambda i: any(t in want for t in words[i]["tags"])
    if key == "at":
        want = {v.lower() for v in alts}
        if not want <= {"first", "last"}:
            raise QueryError("at: expects first or last")
        verses = d["verses"]

        def at(i):
            w = words[i]
            n = verses[w["verse"]]["words"]
            return ("first" in want and w["word"] == 1) or ("last" in want and w["word"] == n)

        return at
    raise QueryError(key)


def verse_test(key: str, value: str):
    d = dataset()
    verses = d["verses"]
    if key == "tr":
        rxs = [phrase_regex(x) for x in alternatives(key, value)]
        return lambda v: any(rx.search(d["_verse_en"][v]) for rx in rxs)
    if key in ("surah", "juz", "page"):
        ranges = number_ranges(value, key)
        return lambda v: any(lo <= verses[v][key] <= hi for lo, hi in ranges)
    if key == "ref":
        want = []
        for part in value.split(","):
            m = re.fullmatch(r"([0-9]{1,6}):([0-9]{1,6})(?:-([0-9]{1,6}))?", part.strip())
            if not m:
                raise QueryError(f"ref: expects 2:255 or 2:255-257, got {part!r}")
            want.append((int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))))
        return lambda v: any(verses[v]["surah"] == s and lo <= verses[v]["ayah"] <= hi for s, lo, hi in want)
    if key == "type":
        want = {x.lower() for x in alternatives(key, value)}
        if not want <= {"meccan", "medinan"}:
            raise QueryError("type: expects meccan or medinan")
        return lambda v: d["_surah_type"][verses[v]["surah"]] in want
    if key == "sajdah":
        want = value.strip().lower()
        if want not in ("yes", "no"):
            raise QueryError("sajdah: expects yes or no")
        return lambda v: (verses[v]["sajdah"] is not None) == (want == "yes")
    if key == "has":
        inner = parse(value)
        if len(inner) != 1 or len(inner[0]) != 1 or inner[0][0][1] not in WORD_KEYS:
            raise QueryError('has: expects one word term, e.g. has:"root:شمس"')
        neg, k, val = inner[0][0]
        test = word_test(k, val)
        found = {w["verse"] for i, w in enumerate(d["words"]) if test(i) != neg}
        return lambda v: v in found
    raise QueryError(key)


def run(query: str) -> dict:
    """{"level": "word"|"verse", "hits": [indices]} in mushaf order."""
    d = dataset()
    groups = parse(query)
    results = []
    for terms in groups:
        wterms = [(n, word_test(k, v)) for n, k, v in terms if k in WORD_KEYS]
        vterms = [(n, verse_test(k, v)) for n, k, v in terms if k in VERSE_KEYS]
        vok = lambda v: all(t(v) != n for n, t in vterms)  # noqa: E731
        if wterms:
            hits = [
                i for i, w in enumerate(d["words"])
                if all(t(i) != n for n, t in wterms) and vok(w["verse"])
            ]
            results.append(("word", hits))
        else:
            results.append(("verse", [v for v in range(len(d["verses"])) if vok(v)]))

    levels = {lvl for lvl, _ in results}
    if levels == {"word"}:
        hits = sorted({i for _, h in results for i in h})
        return {"level": "word", "hits": hits}
    verse_hits = set()
    for lvl, h in results:
        verse_hits.update(d["words"][i]["verse"] for i in h) if lvl == "word" else verse_hits.update(h)
    return {"level": "verse", "hits": sorted(verse_hits)}


def summarize(query: str, limit: int | None = 30) -> dict:
    d = dataset()
    res = run(query)
    verses = d["verses"]
    if res["level"] == "word":
        vidx = [d["words"][i]["verse"] for i in res["hits"]]
        refs = [f"{d['words'][i]['surah']}:{d['words'][i]['ayah']}:{d['words'][i]['word']}" for i in res["hits"]]
    else:
        vidx = res["hits"]
        refs = [f"{verses[v]['surah']}:{verses[v]['ayah']}" for v in vidx]
    by_surah: dict[int, int] = {}
    for v in vidx:
        by_surah[verses[v]["surah"]] = by_surah.get(verses[v]["surah"], 0) + 1
    types = {"meccan": 0, "medinan": 0}
    for v in vidx:
        types[d["_surah_type"][verses[v]["surah"]]] += 1
    out = {
        "query": query,
        "level": res["level"],
        "count": len(res["hits"]),
        "verses": len(set(vidx)),
        "surahs": len(by_surah),
        "meccan": types["meccan"],
        "medinan": types["medinan"],
        "by_surah": dict(sorted(by_surah.items())),
        "refs": refs if limit is None else refs[:limit],
    }
    if res["level"] == "word":
        spellings: dict[str, int] = {}
        for i in res["hits"]:
            spellings[d["words"][i]["plain"]] = spellings.get(d["words"][i]["plain"], 0) + 1
        out["spellings"] = dict(sorted(spellings.items(), key=lambda kv: -kv[1])[:15])
    return out


def main(argv: list[str]) -> None:
    as_json = "--json" in argv
    full = "--all" in argv
    queries = [a for a in argv if not a.startswith("--")]
    if not queries:
        raise SystemExit(__doc__)
    for q in queries:
        try:
            s = summarize(q, limit=None if full else 30)
        except QueryError as e:
            raise SystemExit(f"{q}: {e}")
        if as_json:
            print(json.dumps(s, ensure_ascii=False))
            continue
        print(f"{q}\n  {s['count']} {s['level']} hits in {s['verses']} verses, {s['surahs']} surahs "
              f"(meccan {s['meccan']}, medinan {s['medinan']})")
        if "spellings" in s:
            print("  spellings:", ", ".join(f"{k} {v}" for k, v in s["spellings"].items()))
        print("  refs:", " ".join(s["refs"]) + (" ..." if s["count"] > len(s["refs"]) else ""))


if __name__ == "__main__":
    main(sys.argv[1:])
