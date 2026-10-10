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
## Discoveries

The page ships with **106 discoveries**, saved searches with a short explanation: Numbers & time (13), Famous claims (15), People & places (13), Nature & cosmos (13), Structure (15), Meccan & Medinan (12), Pairs & echoes (15), Themes & language (10). Each was found by a research pass over the data and re-checked by a separate pass that tried to disprove it, and the build re-runs every count. Open one with `index.html#<id>`, for example `index.html#claims-day-365`.

### Popular number claims, tested

| Claim | Verdict | What the data says |
|---|---|---|
| The word qul (say) appears 332 times, and qalu (they said) also appears 332 times. | ✓ holds | Holds when every occurrence of each verb form is counted, prefixes included. A search by spelling finds one more قل, at 4:7, but that is a different verb (qalla, 'is little') and is rightly left out. |
| Man (rajul) and woman (imra'a) are each mentioned 24 times. | ✓ holds | Holds for the singular word with any prefix or suffix. Adding the duals (5 'two men', 2 'two women') gives 29 and 26. |
| Angels and devils are each mentioned 88 times. | ✓ holds | Holds when singular, dual and plural are counted together. Plurals alone give 73 angels and 18 devils. |
| Dunya (this world) and akhira (the Hereafter) each appear 115 times. | ✓ holds | Holds when every occurrence of each word is counted. By meaning it is less tidy: 6 of the akhira words are glossed 'the last', and dunya sometimes means 'nearest', as in 'the nearest heaven' (37:6, 41:12, 67:5) and 'the near side' of the valley (8:42). |
| Jesus (Isa) and Adam are each named 25 times. | ✓ holds | Holds for the personal names. Jesus is also called al-Masih (the Messiah) 11 times, which the claim does not count. |
| Yawm (day) appears 365 times, and ayyam (days) appears 30 times. | ≈ partly | 365 needs two exclusions: every singular gives 375, or 445 with yawma'idhin (475 for all forms). 'Days' is 27 for the plural alone and reaches 30 only when the 3 duals are added. |
| 'Sea' appears 32 times and 'land' 13 times, matching Earth's 71% water and 29% land. | ≈ partly | Holds only under that rule. Every singular sea word gives 33 against 12 land words (73%), and every form of بحر gives 41 (77%). |
| Allah appears 2,698 times (19 × 142), al-Rahman 57 (19 × 3), al-Rahim 114 (19 × 6) and ism (name) 19 times. | ≈ partly | Rahman holds. Allah and Rahim fit only after dropping 9:128-129, which hold one of each; Rashad Khalifa, who popularised the claim, rejected those verses, but they are in the standard text. Ism gives 19 only if بسم and 'his name' are skipped (27 singular forms in all). |
| Paradise (jannah) and Hell (jahannam) are each mentioned 77 times. | ✕ does not hold | Jahannam is 77, but jannah is 147 in all forms, 68 in the singular (70 counting two singulars the corpus tags as plural, at 56:89 and 57:21) and 51 as the name al-Jannah. Only the plural and dual 'gardens' come to 77, and that leaves out every singular 'Paradise'. |
| Life (hayat) and death (mawt) are each mentioned 145 times. | ✕ does not hold | The nouns give 76 and 50, and the whole roots ح ي ي and م و ت give 189 and 165. Other splits do not match either: nouns from each root give 118 and 105, verbs 71 and 60. |
| Zakat and barakah (blessing) each appear 32 times. | ≈ partly | It works only by mixing rules: one word (zakat) against a whole root (b-r-k). Counted the same way on both sides, root ز ك و gives 59 and the noun barakah gives 3. |
| The 'seven heavens' are mentioned 7 times. | ✓ holds | Counting the verses where sab' (seven) and sama' (heaven) appear together gives exactly 7, and the translation search tr:"seven heavens" finds the same 7. Adding 23:17 and 78:12, which speak of seven above you, gives 9. |
| The basmala has 19 letters. | ✓ holds | Holds for the letters as written. The small alif over الرحمن is a mark, not a letter; spelling the word out as الرحمان with a full alif, as the plain spelling used for search here does, gives 20. |
| The word sana (year) appears 19 times. | ✓ holds | Holds when singular and plural are counted together; the singular alone is 7. With عام included, the words for year total 28. |
| Iblis is mentioned 11 times, and seeking refuge from him 11 times. | ✕ does not hold | Iblis is 11, but the refuge root gives 17, or 15 counting verbs only, and أعوذ 'I seek refuge' alone gives 7. Verses that pair refuge with Satan number 5 (3:36, 7:200, 16:98, 23:97, 41:36), so no natural rule gives 11. |

### A few more

- **Every mention of month** (`#month`). The Arabic word for month, shahr, appears 21 times in 17 verses. Twelve are the singular shahr, two are the dual shahrayn (two months) and seven are plurals.
- **Prophets called by name, Muhammad never** (`#people-called-by-name`). Earlier prophets are called by name with 'O' 53 times, and 'O Musa' alone accounts for 24. The callers include God, angels, followers and opponents. No verse says 'O Muhammad': he is addressed as 'O Prophet' or 'O Messenger' in 15 verses, all Medinan.
- **Maryam, the only woman named** (`#people-maryam-only-woman`). Maryam is named 34 times, more often than her son Isa (25), and 23 of those are in the phrase 'son of Maryam'. Surah 19 bears her name but names her only 3 times, while Surah 5 names her 10 times.
- **Yusuf stays in Surah 12, Musa spreads to 34 surahs** (`#people-yusuf-one-surah`). Yusuf is named 27 times, and 25 of those fall in Surah 12, between verses 4 and 99 of its 111 verses. Musa, named 136 times, more than any other prophet, is spread across 34 surahs.
- **Sun and moon share 18 verses, sun first in 17** (`#nature-sun-moon-pair`). The sun is named in 32 verses and the moon in 26, and 18 verses name both. In 17 of those 18 the sun comes first. Only 71:16 puts the moon ahead.
- **Bee, ant, spider, elephant: each in one verse** (`#nature-namesake-creatures`). Surahs 16, 27, 29 and 105 are named after the bee, the ant, the spider and the elephant. Each creature is named in a single verse, and that verse is inside its own surah. The fig of surah 95 is the same, and the cow is named 9 times, 5 of them in the story at 2:67-71 that gives Al-Baqara its name.
- **One line repeated 31 times in Surah 55** (`#structure-rahman-refrain`). In Surah 55, Ar-Rahman, the verse "So which of the favors of your Lord would you deny?" comes 31 times in 78 verses, from 55:13 to 55:77. After its first appearance it returns every second or third verse. No other verse in the Quran is repeated as often.
- **The basmala: 114 times, but not in Surah 9** (`#structure-basmala-114`). "In the name of Allah, the Entirely Merciful, the Especially Merciful" heads every surah except Surah 9, and appears once more inside 27:30, in Solomon's letter to the Queen of Sheba. That makes 114, one for each surah. Only in Surah 1 is it a numbered verse, so the grid shows just two: 1:1 and 27:30.
- **14 letters that open 29 surahs** (`#structure-disconnected-letters`). Twenty-nine surahs open with letters recited one by one, such as Alif Lam Mim; Surah 42 has two such verses, so there are 30 in all. Together they use 14 different letters, exactly half the 28-letter alphabet, in 14 different combinations. The seven surahs that open with Ha Mim stand in an unbroken row, 40 to 46.
- **The middle word of the Quran** (`#structure-middle-word`). Counting all 77,429 words, the middle one is the 38,715th: la-ttakhadhta, "you could have taken", in 18:77, as Moses speaks to al-Khidr. It falls just after the start of juz 16, the halfway mark of the 30 parts, on page 302 of 604. By verse count the middle comes much later, between 26:186 and 26:187, because the second half by words holds 4,019 verses to the first half's 2,217.
- **Allah leans Medinan, Lord leans Meccan** (`#meccan-allah-vs-lord`). Medinan surahs hold 39% of the Quran's words but 1,729 of its 2,699 mentions of Allah (64%). The word Lord (rabb) leans the other way: only 213 of its 977 mentions (22%) are Medinan. In Meccan surahs the two names are close, 970 to 764; in Medinan surahs Allah leads about 8 to 1.
- **"O you who believe" and "O mankind"** (`#meccan-o-believers-o-mankind`). All 89 verses that say "O you who believe" are in Medinan surahs, and so are all 13 that say "O Prophet". The wider call "O mankind" is split almost evenly: 10 of its 21 uses are Meccan and 11 Medinan.
- **Kalla ("Nay!") occurs only in Meccan surahs** (`#meccan-kalla`). The rebuttal kalla, glossed "Nay" or "By no means", appears 33 times in 15 surahs, all of them Meccan. It never occurs in the first half of the Quran: the first one is 19:79 on page 311, and 18 of the 33 are in the last juz.
- **Forgiving and Merciful, side by side** (`#pairs-forgiving-merciful`). The name Ghafur, Forgiving, is used in 91 verses, and 72 of them also use Rahim, Merciful. Whenever the two names meet they end the verse: 71 times as Ghafur Rahim and once, in 34:2, as Rahim Ghafur.

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
