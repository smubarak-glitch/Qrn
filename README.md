# Quran Grid Explorer

The whole Quran laid out as a square grid on black: every square is one of its
77,429 words, read like an Arabic page from the top right. Pick one of 47 trends
found in the text, each with what was found, why it matters and how it was
counted, or search any word, root or idea and see every match light up as a
white dot. Up to three searches can be compared at once.

![The Quran as a 279 × 278 grid of words, with a white dot at each of the 21 mentions of month](docs/month-grid-words.svg)

Open **`index.html`** in a browser. It is one self-contained file (about 2 MB)
with the whole text inside, so it works offline and from disk. The trends are
listed beside the grid; grid options (word, verse or page squares, book or
revelation order, shading), a surah-by-surah chart and the matching verses sit
below it.

### How the trends were found

Most trends come from analysing the text directly rather than from claims found
online. The surahs were split into thirds by the traditional revelation order
(38 surahs each), and word families, grammar forms, verse lengths, verse endings
and openings were compared across those periods and between Meccan and Medinan
surahs, always against the share of the text each part holds. Words that lean
strongly to one period were ranked with a log-likelihood test. A trend was kept
only when the difference is large and the count was checked a second way (for
example by period and by Meccan or Medinan surah, or in the Arabic and in the
translation). Popular
number claims were checked too, and only those that hold are included. Every
trend's counts are saved searches that the build re-runs.

<!-- DISCOVERIES:BEGIN -->
## Trends

The page ships with **47 trends**, each a saved search with what it shows and why it matters: Big picture (6), Mecca & Medina (10), Words & meaning (7), People & stories (9), Nature (5), Numbers (10). Most come from analysing the text directly; the rest are popular claims that were checked and hold. Claims that did not hold were left out. The build re-runs every count. Open one with `index.html#<id>`, for example `index.html#lord-to-allah`.

### Big picture

- **The book runs long to short, not first to last** (`#book-order`). After the short opening prayer, the surahs are arranged roughly from longest to shortest. That turns the order of revelation almost upside down: 9 of the 10 earliest surahs sit in the last 6% of the book. Only Al-Fatiha, the opening, is at the front. *Why it matters:* Reading from page one, you meet the late Medinan surahs first and the very first revelations last. The book is arranged for recitation and use, not as a history. To follow the message as it unfolded, switch the grid to revelation order.
- **Verses grow longer over time** (`#verse-length`). The 38 earliest surahs average 5 words per verse. The middle 38 average 12 and the last 38 average 16. Of the 43 verses with 50 words or more, 41 are Medinan; the longest, 2:282 on writing down debts, has 128. *Why it matters:* Short, rhythmic lines suit the early preaching in Mecca: easy to hear, remember and repeat. Long verses come with laws, treaties and detailed instructions in Medina. Verse length is one of the main clues scholars use to tell early passages from late ones.
- **Three in four neighbouring verses rhyme** (`#rhyme`). In 74% of cases a verse ends on the same letter as the verse before it. If endings were scattered at random it would be about 30%. Almost half of all verses (3,052 of 6,236) end in -un or -in, and all 55 verses of Surah 54 end in r. *Why it matters:* The Quran is rhymed prose, meant to be heard. Rhyme marks where a verse ends, binds a passage together and helps memorisation, and a change of rhyme often signals a new section. Meccan surahs rhyme more tightly (77%) than Medinan ones (65%).
- **The mystery letters introduce the Book** (`#mystery-letters`). 29 surahs open with letters read one by one, such as Alif Lam Mim. In 23 of them the next words are about the Book or its revelation: 'This is the Book about which there is no doubt' (2:2). Among the other 85 surahs, only 17 start that way. *Why it matters:* No one knows for sure what the letters mean; it is one of the oldest puzzles in the Quran. But they are not placed at random. They work like a heading for scripture, introducing the Book 79% of the time against 20% elsewhere, which fits the classical view that they point to the text itself.
- **Refrains: lines that come back again and again** (`#refrains`). 265 verses repeat word for word somewhere else in the Quran, not counting the opening letters. Many are refrains: 'Which of the favours of your Lord would you deny?' comes 31 times in Surah 55, and 'Woe, that Day, to the deniers' 10 times in Surah 77. 214 of the 265 are Meccan. *Why it matters:* Refrains are a mark of texts made to be recited aloud. They give the listener a beat, show where one section ends and the next begins, and drive the point home. Their weight in the Meccan surahs fits the public, spoken preaching of that period.
- **The earliest surahs use the rarest words** (`#rare-words`). 399 of the Quran's 1,651 word roots are used only once. The 38 earliest surahs have 18 of these one-time words per 1,000 words; later surahs have about 4. The hoopoe (27:20), the elephant (105:1) and Ramadan (2:185) are among them. *Why it matters:* The first revelations pack in vivid, unusual words, many of them picturing the end of the world. That is part of why they are the hardest to translate and the most admired for their style. Later surahs draw on a settled, repeated vocabulary as the message and the community take shape.

### Mecca & Medina

- **Mecca warns, Medina organises** (`#two-vocabularies`). Six words, create, warn, warner, send, generations and criminals, appear 491 times, and 88% of them are in Meccan surahs. Six others, fight, spend, women, what is right, blame and hypocrites, appear 271 times, and 91% are Medinan. Medinan surahs hold only 39% of the text. *Why it matters:* The vocabulary follows the situation. In Mecca a small, pressured group hears about creation, judgment and the nations destroyed before them. In Medina a growing community needs rules for war, charity and marriage, and for people who only pretend to believe. The words are a record of that history.
- **From 'you' to 'you all'** (`#you-to-you-all`). In the earliest surahs, 75% of commands speak to one person: 'Recite!' (96:1), 'Arise and warn' (74:2). The share falls to 63% in the middle period and 37% in the last, as commands to a group, such as fight, spend and obey, take over. *Why it matters:* At first the Quran mostly speaks to the Prophet himself. Later it speaks to a whole community. The grammar of its commands records the change from one man's mission to a people's way of life.
- **From 'be patient' to 'fight'** (`#patience-to-fighting`). The command 'be patient' comes 29 times, 25 of them in Meccan surahs. 'Fight' and 'fighting' come 67 times, and 66 of those are Medinan. The one Meccan case, 73:20, is a long closing verse that many scholars date to Medina. *Why it matters:* In Mecca the early Muslims were a persecuted minority without power, and the message to them is to endure. After the move to Medina they had a town to defend, and the text turns to war: when to fight, when to stop and how. These two words trace that turning point.
- **From 'your Lord' to 'Allah'** (`#lord-to-allah`). In the 38 earliest surahs, God is called 'Lord' (rabb) twice as often as 'Allah'. In the last third it is the reverse, seven to one: 54 uses of 'Allah' per 1,000 words against 7 of 'Lord'. 29 surahs never say 'Allah' at all, and 27 of them are Meccan. *Why it matters:* The earliest revelations speak of God in personal terms: 'Recite in the name of your Lord who created' (96:1). Later, above all in the laws and public addresses of Medina, the name Allah dominates. How the text names God is one of the clearest signs of how its voice changed.
- **Questions give way to 'if'** (`#questions-to-conditions`). The earliest surahs ask 22 questions per 1,000 words: 'Have We not made the earth a resting place?' (78:6). In the last third that falls to 9, while 'if' and 'whoever' clauses rise from 5 to 18 per 1,000. *Why it matters:* Questions are how you persuade a doubting listener: they make the audience supply the answer. Conditions are how you write rules: if this happens, do that. The swap mirrors the move from preaching to governing.
- **The laws come late, and fill little space** (`#laws-come-late`). Words for six core legal topics, marriage, divorce, fasting, pilgrimage, retaliation and bequests, appear 74 times in 53 verses: under 1% of the Quran's 6,236 verses. 72 of the 74 are in Medinan surahs, and 24 of the 53 verses are in Surah 2. *Why it matters:* The Quran is sometimes pictured as mainly a law book. By verse count it is not, and the law it does contain arrives after the community settled in Medina and needed rules. The two Meccan uses are inside stories: Maryam's vow of a fast (19:26) and the marriage offered to Moses (28:27).
- **Oaths open Meccan surahs, calls open Medinan ones** (`#oaths-and-calls`). 17 surahs begin with an oath, such as 'By the dawn' or 'I swear by this city', and every one is Meccan. 10 begin with a call, 'O mankind', 'O Prophet' or 'O you who believe', and 8 of those are Medinan. *Why it matters:* An oath calls the sky, the sun and time itself as witnesses: the voice of someone persuading a doubtful crowd. A call to 'you who believe' needs a community of believers to speak to. A surah's first words are a good clue to when it came.
- **'O you who believe': 89 times, all in Medina** (`#o-you-who-believe`). Every one of the 89 verses that call 'O you who believe' is in a Medinan surah, and so are all 13 that say 'O Prophet'. Meccan surahs use wider calls, like 'O mankind', or the 'O my people' of earlier prophets (45 of its 49 uses). *Why it matters:* You can only address 'you who believe' once there is a community of believers. These calls usually introduce an instruction, and they appear exactly where the community took shape. 'O Prophet' likewise belongs to the years when Muhammad led a city.
- **From Israel's past to the People of the Book** (`#people-of-the-book`). Israel is named 43 times, nearly always as 'the Children of Israel', and 26 of those are Meccan, inside the story of Moses. But 30 of the 31 verses about 'the People of the Book' are Medinan, as are all 14 mentions of Christians, 19 of the 21 mentions of Jews and 21 of the 25 mentions of Jesus. *Why it matters:* In Mecca, Jews and Christians appear mostly as history: the people Moses led out of Egypt. In Medina the Prophet lived beside Jewish tribes and dealt with Christians, and the text turns to arguing with them directly. The words show when these communities became neighbours rather than stories.
- **'Nay!' belongs to Mecca** (`#kalla-meccan`) *(popular claim, checked)*. The sharp rebuttal kalla, 'Nay!' or 'By no means!', appears 33 times in 15 surahs, every one of them Meccan, and never in the first half of the book. 18 of the 33 are in the last juz. *Why it matters:* Kalla is the language of argument: it cuts off an opponent's claim. It belongs to the debates with the Meccan elite and disappears once the community moves to Medina, where the opponents and the tone change.

### Words & meaning

- **A verse's ending echoes what it says** (`#endings-echo-content`). Verses that speak of forgiveness or repentance end on 'Forgiving', 'Merciful' or 'Accepting of repentance' 28% of the time. Other verses end that way under 2% of the time. Verses about creation close on 'All-Powerful' about 7 times more often than others. *Why it matters:* The names of God that close verses are not a fixed refrain. They comment on what the verse has just said: mercy after forgiveness, power after creation. Classical scholars praised this fit between a verse and its ending, and the counts bear it out.
- **Faith almost never comes without deeds** (`#faith-and-deeds`). 'Righteous deeds' are mentioned 62 times, and 52 of those share a verse with 'believe', which always comes first. The exact phrase 'those who believe and do righteous deeds' occurs 50 times. *Why it matters:* Again and again the Quran ties belief to action: faith is shown in what people do. This pairing is one of its most repeated formulas and a key to its ethics.
- **Prayer and charity go together** (`#prayer-and-charity`). Zakah, the obligatory charity, is named in 32 verses, and 26 of them also name prayer, always first: 'establish prayer and give zakah'. Prayer appears in 78 verses, so it often stands alone, but zakah rarely does. *Why it matters:* Worship of God and care for the poor are presented as one pair of duties, not two separate ones. That link is why zakah stands beside prayer among the five pillars of Islam.
- **Signs for people who think** (`#signs-for-thinkers`). 28 verses say that something in nature or history holds 'signs for a people' who give thought, reason, believe or listen, and 25 of them are Meccan. The noun for reason never appears: all 49 uses of the root 'aql are verbs, 13 of them the question 'Will you not reason?' *Why it matters:* The Quran points to rain, stars, night and day as evidence and asks the listener to draw the conclusion. Reason is something you do, not something you have. It is an argument from observation, aimed at people still to be convinced.
- **Darkness is always plural, light singular** (`#darkness-and-light`) *(popular claim, checked)*. All 23 uses of the noun zulma (darkness) are the plural zulumat, 'darknesses', and all 43 uses of nur (light) are singular. The two appear together in 13 verses, and darkness comes first in 11 of them, as in 'He brings them out from darknesses into the light' (2:257). *Why it matters:* The grammar carries a picture: there are many ways to be lost but one light to be guided by. Commentators have long read it as many paths of error against one truth.
- **'One' is mostly about God** (`#one-is-god`). The word wahid, 'one', appears 30 times, and 22 of them describe God: 'Your God is one God' (2:163). The other 8 count ordinary things: one kind of food, one gate, one water. *Why it matters:* Numbers in the Quran rarely measure quantity. 'One' is used above all to state its central teaching, that God is one.
- **The most used word families: God, say, Lord** (`#most-used-roots`). The root of God's name appears 2,851 times, more than any other. Next come 'say' (1,722), 'be' (1,390), 'Lord' (980), 'believe' (879) and 'know' (854). 'Lord' appears in 94 of the 114 surahs. *Why it matters:* The top word families sum up the book: it is about God, and it is speech. 'Say' ranks second because so much of the Quran is dialogue: the Prophet is told what to say, and the words of prophets, angels and opponents are reported.

### People & stories

- **Stories of earlier prophets peak in the middle years** (`#stories-peak-middle`). Moses, Abraham, Noah, Lot, Hud, Salih, Shu'ayb, Joseph and Pharaoh are named 403 times, and 293 of those (73%) fall in the middle third of the revelation, which holds half the words. Moses alone has 108 of his 136 mentions there. *Why it matters:* In the later Meccan years, as opposition hardened, the Quran retells how earlier messengers were mocked and rejected before being proved right. The stories console the Prophet and warn his opponents. In Medina they give way to the community's own present.
- **Prophets are called by name, Muhammad never** (`#called-by-name`) *(popular claim, checked)*. Earlier prophets are called by name 53 times; 'O Moses' alone accounts for 24. No verse says 'O Muhammad': he is called 'O Prophet' or 'O Messenger' (15 verses). His name appears only 4 times, plus 'Ahmad' once, all in Medinan surahs. *Why it matters:* The Quran speaks to Muhammad rather than about him: he is the 'you' of the text. Calling him only by title has long been read as a mark of honour, and it keeps attention on the message rather than the man.
- **Maryam, the only woman named** (`#maryam-only-woman`) *(popular claim, checked)*. Maryam (Mary) is named 34 times, more often than her son Jesus (25), and 23 of those are in the phrase 'son of Maryam'. No other woman is named: the wives of Noah, Lot and Pharaoh, the mother of Moses and the Queen of Sheba all appear without names. *Why it matters:* Women play real parts in the Quran's stories, but only Mary is named, and a whole surah carries her name. It marks the unique honour the Quran gives her, and a meeting point with Christian tradition.
- **Joseph's story is told whole, Moses' in pieces** (`#joseph-whole-moses-pieces`). Joseph (Yusuf) is named 27 times, and 25 of those are in Surah 12, which tells his story from beginning to end. Moses (Musa), named 136 times, more than anyone else, is spread across 34 surahs. *Why it matters:* Most Quranic stories are told in pieces, each retelling chosen to make a different point. Joseph's is the exception, and the surah itself calls it 'the best of stories' (12:3). To follow the life of Moses, you have to gather it from across the book.
- **Iblis refuses, Shaytan tempts** (`#iblis-and-shaytan`). The name Iblis appears 11 times, and 8 of those verses tell how the angels bowed to Adam and Iblis refused. When the story moves on to the garden and the temptation, he is called al-Shaytan instead (2:36, 7:20, 20:120), a name used 64 times. *Why it matters:* The two names follow two roles. Iblis is the proud individual who refuses God's command; Shaytan is the tempter at work in the world. The Quran switches names as the story switches scenes.
- **Noah, 'Ad, Thamud, Lot: always in that order** (`#ancient-nations-order`). 'Ad and Thamud, two ancient Arabian peoples, are named together in 17 surahs, and 'Ad comes first in 15. Where Noah, 'Ad, Thamud and Lot all appear, 6 of 8 surahs name them in that order. 88% of the mentions of Noah, 'Ad and Thamud are in Meccan surahs. *Why it matters:* These stories follow a fixed pattern and sequence, like a timeline of warnings: each people rejected its prophet and was destroyed. Told mostly in Mecca, they were a pointed warning to the Prophet's own opponents.
- **25 prophets, 18 of them in four verses** (`#twenty-five-prophets`) *(popular claim, checked)*. The 25 prophets named in the Quran are mentioned 510 times in all, and Musa accounts for 136 of those. Four verses of Surah 6 (6:83-86) name 18 of the 25, one after another. *Why it matters:* The Quran presents the prophets as one continuous line, from Adam to Jesus, with Muhammad as the last. Most of the 25 are figures from the Bible, which shows how much sacred history the Quran shares with Jewish and Christian scripture.
- **Only two people of the Prophet's time are named** (`#contemporaries-unnamed`). Apart from Muhammad himself, the only people of his own time named in the Quran are Zayd (33:37) and Abu Lahab (111:1). Everyone else, friend or enemy, is described but not named. *Why it matters:* Even when it responds to specific events, the Quran speaks in general terms. Leaving out names keeps its lessons from being tied to particular people, so each passage can speak to any time.
- **Mecca and Medina are named only in Medinan surahs** (`#places-named`). Mecca (as Makkah and Bakkah), Medina (with its old name Yathrib) and local sites such as Badr, Hunayn, the Ka'ba, Safa, Marwa and Arafat are named 14 times, all in Medinan surahs. Egypt and Sinai, the scenes of Moses' story, are named only in Meccan ones. *Why it matters:* In Mecca, the named places belong to stories set far away and long ago. In Medina, the text names the places where the community lives, fights and makes pilgrimage. Place names show when the Quran began to speak about its own setting.

### Nature

- **Night before day, sun before moon** (`#night-before-day`). Night and day share 42 verses, and night is named first in 40. The sun comes before the moon in 17 of their 18 shared verses (71:16 is the exception), and heaven before earth in 201 of 222. Side by side, 'the heavens and the earth' occurs 148 times and 'the earth and the heavens' only twice. *Why it matters:* Paired words settle into fixed formulas, as they do in texts made for recitation. Night before day also matches the Arabian and Islamic way of counting, in which each day begins at sunset.
- **Many heavens, one earth** (`#heavens-and-earth`). The word ard (earth) appears 461 times and is never plural, while sama' (sky, heaven) is plural in 190 of its 310 uses. The plural samawat appears in 188 verses, and 181 of them also name the earth. In 173 of those 181 verses the heavens come first. *Why it matters:* The Quran pictures the heavens in layers, the 'seven heavens', while the earth stays one. Together, 'the heavens and the earth' is its standard phrase for the whole universe.
- **Gardens beneath which rivers flow** (`#rivers-beneath`). Rivers are mentioned 54 times, and 40 of them sit in the phrase 'beneath which rivers flow'. Nearly all of these describe Paradise; the clear exceptions are a parable garden (2:266), destroyed nations (6:6) and Pharaoh's boast of 'these rivers flowing beneath me' (43:51). The four rivers of 47:15, of water, milk, wine and honey, are among the others. *Why it matters:* For listeners in dry western Arabia, running water was the clearest picture of plenty and rest. Paradise is described with it again and again, in a phrase that works like a refrain.
- **The date palm leads the orchard** (`#date-palm`). The word nakhl (date palm) appears in 20 verses, more than any other fruit plant. Grapes come next with 11 verses, and 9 of them also name the date palm. All 3 pomegranate verses (6:99, 6:141, 55:68) name it too. *Why it matters:* The Quran's plants are the plants its first listeners knew: date palm, grapevine, olive, pomegranate and fig. Its pictures of God's gifts are drawn from their own fields and markets.
- **'Each in an orbit' reads the same backwards** (`#orbit-palindrome`) *(popular claim, checked)*. Two verses say the sun, moon, night and day each swim in an orbit (21:33, 36:40). These are the only places the word falak (orbit) appears. The phrase kullun fi falak is written ك ل ف ي ف ل ك, the same letters from either end. *Why it matters:* A small piece of wordplay anyone can check: in the verses about the sun and moon moving in their orbits, the letters of the phrase go round and come back. It proves nothing on its own, but it shows how closely sound and meaning are crafted in places.

### Numbers

- **Every mention of month** (`#month`). The word for month, shahr, appears 21 times in 17 verses: 12 times as 'month', twice as 'two months' and 7 times as 'months'. 14 of the 17 verses are in Medinan surahs, and 9:36 says that 'the number of months with Allah is twelve'. *Why it matters:* Month is a word of law and worship: the fast of Ramadan (2:185), the sacred months, waiting periods after a divorce or a death, and two months of fasting to make amends. That is why it gathers in the Medinan surahs, the period of the laws.
- **Six is only used for the days of creation** (`#six-days`). The number six appears 7 times, always for the six days in which the heavens and the earth were created. Five of those verses use identical words: 'in six days, then He rose over the Throne'. *Why it matters:* Creation in six days is shared with the Bible, but the Quran has no day of rest; instead it says 'and no weariness touched Us' (50:38). The number six is kept for this one story.
- **Three hundred years, and nine more** (`#cave-309`) *(popular claim, checked)*. The sleepers of the cave stayed 'three hundred years and exceeded by nine' (18:25). Three verses earlier, 18:22 reports people's guesses about how many they were: three, five or seven, with their dog the fourth, sixth or eighth, so the verse runs through every number from three to eight. *Why it matters:* Many readers take 'and nine more' as the gap between solar and lunar years: 300 solar years come to about 309 lunar years. The verse does not mention calendars, so this is a reading, but the arithmetic works.
- **Fractions belong to inheritance law** (`#fractions-inheritance`). Words for fractions (half, third, quarter, fifth, sixth, eighth, tenth) appear 21 times. Thirteen sit in just three verses, the inheritance shares of 4:11, 4:12 and 4:176. Four of the other eight measure the night prayer in surah 73, which speaks of 'almost two thirds of the night or half of it or a third of it' (73:20). *Why it matters:* The Quran's arithmetic is practical. Its exact inheritance shares grew into a whole field of Islamic law, and working them out was a major use of mathematics: al-Khwarizmi's famous book on algebra gives a long section to inheritance problems.
- **Man and woman: 24 each** (`#man-and-woman`) *(popular claim, checked)*. In the singular, رَجُل (a man) occurs 24 times, and امْرَأَة (a woman, often meaning 'wife') also occurs 24 times. Both counts include every prefix and suffix and leave out the dual forms 'two men' and 'two women'. *Why it matters:* Equal counts for paired words are the most shared kind of Quran number claim, and this one holds for the singular words. It matches a text that often speaks to men and women side by side, as in 33:35, which praises 'the believing men and believing women' alike.
- **Angels and devils: 88 each** (`#angels-and-devils`) *(popular claim, checked)*. Counting singular, dual and plural together, the word for angel (مَلَك, مَلَائِكَة) occurs 88 times. The word for devil (شَيْطَان, شَيَاطِين) also occurs 88 times. The split is different: angels are mostly plural (73), while Shaitan is mostly singular (70). *Why it matters:* It holds when singular and plural are counted together. With thousands of possible word pairs, some exact ties are expected by chance, and other famous pairs do not hold, so this is a curiosity rather than proof of a hidden code.
- **This world and the Hereafter: 115 each** (`#world-and-hereafter`) *(popular claim, checked)*. الدُّنْيَا (this world) occurs 115 times, and الآخِرَة (the Hereafter) also occurs 115 times. Each count covers every occurrence of the word, with any prefix. *Why it matters:* The contrast between this life and the next runs through the whole Quran, so an exact tie between the two words is a striking curiosity. It holds when every form of each word is counted.
- **Jesus and Adam: 25 each** (`#jesus-and-adam`) *(popular claim, checked)*. The name عِيسَى (Jesus) occurs 25 times, and آدَم (Adam) also occurs 25 times. They meet in one verse, 3:59: 'the example of Jesus to Allah is like that of Adam.' Jesus is named mostly in Medinan surahs (21 of 25) and Adam mostly in Meccan ones (17 of 25). *Why it matters:* Here the count echoes the text itself. 3:59 compares the two directly: both were brought into being by God's word 'Be', Adam without parents and Jesus without a father.
- **The basmala: 114 times, 19 letters** (`#basmala`) *(popular claim, checked)*. 'In the name of Allah, the Entirely Merciful, the Especially Merciful' heads every surah except Surah 9, and appears once more inside 27:30, in Solomon's letter to the Queen of Sheba. That makes 114, one for each surah. As written, it has 19 letters. *Why it matters:* The basmala opens almost every surah and is said before almost any action in Muslim life. Its 19 letters are the starting point of a popular theory about the number 19, which takes its cue from 74:30, 'Over it are nineteen'.
- **'Say!' and 'They said': 332 each** (`#say-and-they-said`) *(popular claim, checked)*. The command قُلْ "Say!", addressed to one person, occurs 332 times. قَالُوا "they said" also occurs 332 times. Both counts include forms with a prefix such as و or ف attached in front. *Why it matters:* 'Say' is the Quran's signature command: hundreds of times the Prophet is handed the exact words of his reply, which presents the text as a message given to him rather than his own speech. That the count equals 'they said', the voice of his audience, is a curiosity on top.

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
| `ar:*ون`, `ar:ال*` | spelling ends with / starts with |
| `tr:"sacred month"` | verses whose English translation has the phrase |
| `tag:PN`, `pos:V` | grammar: proper nouns, verbs, `INL` disconnected letters, `NEG`, `VOC`… |
| `surah:2`, `juz:30`, `page:1`, `2:255`, `ref:2:1-5` | places in the text |
| `type:meccan`, `sajdah:yes` | Meccan or Medinan surahs, verses of prostration |
| `length:50-200` | verses of 50 to 200 words |
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
4. Re-runs every trend in `data/discoveries.json` with the reference engine
   (`scripts/query.py`), stops if any stated count is wrong, and writes the
   trends section of this README.
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
| `data/discoveries.json` | the trends: what each shows, why it matters, how it was counted, and its checked searches |

## Sources

- Words, roots and grammar: [Quranic Arabic Corpus](https://corpus.quran.com)
  morphology v0.4 (GPL), via
  [mustafa0x/quran-morphology](https://github.com/mustafa0x/quran-morphology).
- Word-by-word English, transliteration and plain spelling:
  [Quran.com](https://quran.com) API.
- Surahs, pages, juz, sajdah verses, revelation order and the spelling check:
  [Tanzil Project](https://tanzil.net) (CC BY 3.0).
- English translation: Saheeh International, as published by Tanzil.
