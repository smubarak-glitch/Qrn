# Quran Grid Explorer

The whole Quran laid out as a square grid on black: every square is one of its
77,429 words, read like an Arabic page from the top right. Search any word, root
or idea and every match lights up as a white dot. Compare up to three searches,
shade the grid by verse length, Meccan or Medinan surahs, revelation order or
verse-end rhyme, and browse checked discoveries.

![The Quran as a 279 × 278 grid of words, with a white dot at each of the 21 mentions of month](docs/month-grid-words.svg)

Open **`index.html`** in a browser. It is one self-contained file (about 2 MB)
with the whole text inside, so it works offline and from disk.

<!-- DISCOVERIES:BEGIN -->
<!-- DISCOVERIES:END -->

## Searching

Type in English or Arabic. Plain text searches the word-by-word English
meanings; an Arabic word searches a root if it is one, otherwise a spelling.
Suggestions appear as you type. For more control:

| Search | Finds |
|---|---|
| `month`, `month*` | words whose English meaning is "month" (`*` also finds "months") |
| `root:شمس` | every word built on the root ش م س |
| `lemma:شَهْر` | one dictionary word in all its forms |
| `ar:كتاب`, `ar:=كتاب` | spelling contains / is exactly |
| `tr:"sacred month"` | verses whose English translation has the phrase |
| `tag:PN`, `pos:V` | grammar: proper nouns, verbs, `INL` disconnected letters, `NEG`, `VOC`… |
| `surah:2`, `juz:30`, `page:1`, `2:255`, `ref:2:1-5` | places in the text |
| `type:meccan`, `sajdah:yes` | Meccan or Medinan surahs, verses of prostration |
| `has:"root:شمس" has:"root:قمر"` | verses that contain both words |
| `at:last` | only the last word of each verse |

Spaces mean AND, `|` means OR, commas list alternatives (`root:شمس,قمر`) and a
leading minus excludes (`-tag:DET`). Arabic search ignores vowel marks and folds
letter variants together (أ إ آ ٱ as ا, ى as ي, ة as ه).

The same language runs from the command line:

```sh
python3 scripts/query.py 'root:شهر'
python3 scripts/query.py --json 'en:sun | en:moon'
```

## The month study

The project started with one question: where does the word *month* fall? The
Arabic word **shahr (شهر)** appears **21 times in 17 verses, across 9 surahs**:

| Shape | Meaning | Count |
|---|---|---|
| شَهْر *shahr* | month | 12 |
| شَهْرَيْن *shahrayn* | two months | 2 |
| أَشْهُر *ashhur* | months | 6 |
| شُهُور *shuhūr* | months | 1 |

- 15 of the 21 sit in the first third of the text: eight in Al-Baqara (2:185 to
  2:234, on fasting, fighting in the sacred month, pilgrimage and waiting
  periods), three in An-Nisa and Al-Ma'ida, and four in At-Tawba (9:2, 9:5 and
  9:36 twice).
- Then nothing for about 40% of the Quran, from 9:36 to 34:12.
- The last six are scattered through the lower part: 34:12 (twice), 46:15,
  58:4, 65:4 and 97:3, "better than a thousand months", which is 99.4% of the
  way through.
- The singular *shahr* occurs exactly 12 times. 9:36 says "the number of months
  with Allah is twelve months".

The build cross-checks the list against a plain spelling search of the Tanzil
text for ش ه ر and ش ه و ر, and stops if the two disagree. Saheeh International
adds "month" in brackets in 2:196 and 9:37, but the Arabic word is not there, so
those verses are not counted. Static images: [words](docs/month-grid-words.svg),
[verses](docs/month-grid-verses.svg), [pages](docs/month-grid-pages.svg); the
list with word positions is [`data/month_occurrences.csv`](data/month_occurrences.csv).

## How it is built

```sh
python3 scripts/build.py
```

Standard library only. The build downloads its sources once into `data/raw/`
(ignored by git), then:

1. Loads the Quran word by word (`scripts/quran_data.py`): the Quranic Arabic
   Corpus splits it into 77,429 words in 6,236 verses; each word gets its root,
   dictionary form and grammar tags from the corpus, and its English gloss,
   transliteration and plain spelling from Quran.com. The build stops if the
   sources disagree on any verse or word count.
2. Writes `data/derived/quran_words.json` for the command-line engine.
3. Runs the month study and redraws `docs/month-grid-*.svg`.
4. Re-runs every discovery in `data/discoveries.json` with the reference engine
   (`scripts/query.py`) and stops if any stated count is wrong.
5. Packs the data (gzip + base64) and `src/explorer.js` into `index.html`.

A grid with *n* squares has `ceil(sqrt(n))` columns and as many rows as it
needs: 279 × 278 for words, 79 × 79 for verses and 25 × 25 for the 604 pages of
the Madani mushaf. Leftover squares at the end stay empty.

| File | What it is |
|---|---|
| `index.html` | the explorer (built; styles and markup are edited here) |
| `src/explorer.js` | the page's script, inlined by the build |
| `scripts/query.py` | the search language, reference implementation and CLI |
| `scripts/quran_data.py` | downloads and aligns the sources |
| `scripts/build.py` | builds everything above |
| `data/discoveries.json` | the saved discoveries and their checked counts |

## Sources

- Words, roots and grammar: [Quranic Arabic Corpus](https://corpus.quran.com)
  morphology v0.4 (GPL), via
  [mustafa0x/quran-morphology](https://github.com/mustafa0x/quran-morphology).
- Word-by-word English, transliteration and plain spelling:
  [Quran.com](https://quran.com) API.
- Surahs, pages, juz, sajdah verses, revelation order and the spelling check:
  [Tanzil Project](https://tanzil.net) (CC BY 3.0).
- English translation: Saheeh International, as published by Tanzil.
