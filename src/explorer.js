/* Quran Grid Explorer.
 *
 * Unpacks the word-by-word Quran inlined by scripts/build.py, runs searches with
 * the same query language as scripts/query.py (the reference implementation;
 * keep the two in step), and draws matches on a near-square grid of words,
 * verses or pages.
 */
(() => {
  "use strict";

  // ------------------------------------------------------------------ helpers
  const fmt = new Intl.NumberFormat("en-US");
  const $ = id => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svgEl(tag, attrs) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  // First index i with arr[i] > x.
  function upperBound(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m + 1; else hi = m; }
    return lo;
  }
  function gridShape(n) {
    const cols = Math.ceil(Math.sqrt(n));
    return { cols, rows: Math.ceil(n / cols) };
  }
  const plural = (n, word, many) => `${fmt.format(n)} ${n === 1 ? word : (many || word + "s")}`;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  // Same folding as quran_data.normalize_ar: marks, tatweel and invisible format
  // characters go; letter variants fold; the Uthmani hamza-alif (ءا) reads as ا.
  const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
  const FORMAT = /[\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
  const FOLD = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي" };
  const normalizeAr = s => s.replace(MARKS, "").replace(/[أإآٱىةؤئ]/g, c => FOLD[c]).replace(/ /g, "").replace(/ءا/g, "ا");
  const cleanEnglish = s => s.toLowerCase().replace(/[()[\]]/g, "");
  const ARABIC = /[\u0600-\u06FF]/;
  const spaced = s => [...normalizeAr(s)].join(" ");
  // Wrap Arabic runs in bidi isolates (for aria labels and other plain-text places).
  const iso = s => String(s).replace(/[\u0600-\u06FF][\u0600-\u06FF\s]*[\u0600-\u06FF]|[\u0600-\u06FF]/g, m => "\u2068" + m + "\u2069");

  // Visible text with each Arabic run in <bdi lang="ar">, so numbers and brackets
  // beside Arabic keep their place and screen readers switch language.
  const ARABIC_RUN = /[\u0600-\u06FF][\u0600-\u06FF\s]*[\u0600-\u06FF]|[\u0600-\u06FF]/g;
  function bidi(text) {
    text = String(text);
    const out = [];
    let last = 0;
    for (const m of text.matchAll(ARABIC_RUN)) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const b = document.createElement("bdi");
      b.lang = "ar";
      b.textContent = m[0];
      out.push(b);
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  function elB(tag, cls, text) {
    const e = el(tag, cls);
    e.append(...bidi(text));
    return e;
  }
  function arSpan(text, cls) {
    const s = el("span", cls || "ar", text);
    s.lang = "ar";
    s.dir = "rtl";
    return s;
  }

  const WORDCHAR = "[A-Za-z0-9_]";
  const MAX_WILDCARDS = 4;
  function phraseRegex(value, flags) {
    const words = cleanEnglish(value).split(" ").filter(Boolean).map(w => w.replace(/\*+/g, "*"));
    if (!words.length) throw new QueryError("empty English phrase");
    if (words.reduce((a, w) => a + (w.split("*").length - 1), 0) > MAX_WILDCARDS) throw new QueryError(`use at most ${MAX_WILDCARDS} * wildcards in one phrase`);
    const parts = words.map(w => w.replace(/[.+?^${}()|[\]\\/-]/g, "\\$&").replace(/\*/g, WORDCHAR + "*"));
    return new RegExp(`(?<!${WORDCHAR})` + parts.join(" +") + `(?!${WORDCHAR})`, flags || "");
  }

  class QueryError extends Error {}

  // ------------------------------------------------------------------ data
  const D = {};

  async function unpack() {
    const node = $("quran-data");
    if (!node) throw new Error("The page was built without its data. Run python3 scripts/build.py.");
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack the data. Try a current Chrome, Safari, Firefox or Edge.");
    const bin = Uint8Array.from(atob(node.textContent.trim()), c => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  }

  function buildIndex(raw) {
    D.surahs = raw.surahs.map(([name, name_ar, name_en, verses, rev, type], i) =>
      ({ n: i + 1, name, name_ar, name_en, verses, rev, type: type.toLowerCase() }));
    const V = raw.verse_words.length;
    D.V = V;
    D.verseLen = raw.verse_words;
    D.verseFirst = new Int32Array(V + 1);
    for (let v = 0; v < V; v++) D.verseFirst[v + 1] = D.verseFirst[v] + raw.verse_words[v];
    const N = D.verseFirst[V];
    D.N = N;
    D.surahFirstVerse = new Int32Array(115);
    D.surahs.forEach((s, i) => { D.surahFirstVerse[i + 1] = D.surahFirstVerse[i] + s.verses; });
    D.surahFirstWord = D.surahFirstVerse.map(v => D.verseFirst[v]);
    D.verseSurah = new Uint8Array(V);
    D.verseAyah = new Uint16Array(V);
    D.surahs.forEach((s, i) => {
      for (let a = 0; a < s.verses; a++) { D.verseSurah[D.surahFirstVerse[i] + a] = s.n; D.verseAyah[D.surahFirstVerse[i] + a] = a + 1; }
    });
    D.wordVerse = new Int32Array(N);
    for (let v = 0; v < V; v++) D.wordVerse.fill(v, D.verseFirst[v], D.verseFirst[v + 1]);
    D.pageStart = raw.page_start;
    D.versePage = new Uint16Array(V);
    D.verseJuz = new Uint8Array(V);
    for (let v = 0; v < V; v++) {
      D.versePage[v] = upperBound(raw.page_start, v);
      D.verseJuz[v] = upperBound(raw.juz_start, v);
    }
    D.sajdah = new Map(raw.sajdah);
    D.verseEn = raw.verse_en;
    D.verseEnC = raw.verse_en.map(cleanEnglish);

    D.ar = raw.w_ar;
    D.plain = raw.w_plain;
    D.translit = raw.w_translit;
    D.gloss = raw.w_gloss;
    D.plainN = raw.w_plain.map(normalizeAr);
    D.uthN = raw.w_ar.map(normalizeAr);
    D.glossC = raw.w_gloss.map(cleanEnglish);
    D.pos = raw.w_pos;
    D.roots = raw.roots;
    D.rootsN = raw.roots.map(normalizeAr);
    D.rootSetN = new Set(D.rootsN);
    D.lemmas = raw.lemmas;
    D.lemmasN = raw.lemmas.map(normalizeAr);
    D.lemmasExact = raw.lemmas.map(x => x.replace(FORMAT, ""));
    D.wRoot = Int32Array.from(raw.w_root);
    D.wLemma = Int32Array.from(raw.w_lemma);
    D.extraRoots = new Map();
    for (const [i, r] of raw.extra_roots) { if (!D.extraRoots.has(i)) D.extraRoots.set(i, []); D.extraRoots.get(i).push(r); }
    D.extraLemmas = new Map();
    for (const [i, r] of raw.extra_lemmas) { if (!D.extraLemmas.has(i)) D.extraLemmas.set(i, []); D.extraLemmas.get(i).push(r); }
    D.tagsets = raw.tagsets.map(t => new Set(t ? t.split(" ") : []));
    D.wTags = Uint16Array.from(raw.w_tags);
    D.discoveries = raw.discoveries || [];

    // Counts and the usual English meaning of each root and dictionary word, for suggestions.
    D.rootCount = new Int32Array(D.roots.length);
    D.lemmaCount = new Int32Array(D.lemmas.length);
    const lemmaGlosses = new Map();
    for (let i = 0; i < N; i++) {
      if (D.wRoot[i] >= 0) D.rootCount[D.wRoot[i]]++;
      const l = D.wLemma[i];
      if (l >= 0) {
        D.lemmaCount[l]++;
        const g = simpleGloss(D.glossC[i]);
        if (g) {
          let m = lemmaGlosses.get(l);
          if (!m) lemmaGlosses.set(l, (m = new Map()));
          m.set(g, (m.get(g) || 0) + 1);
        }
      }
    }
    D.lemmaGloss = new Array(D.lemmas.length).fill("");
    for (const [l, m] of lemmaGlosses) D.lemmaGloss[l] = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    D.rootGloss = new Array(D.roots.length).fill("");
    const rootLemmas = new Map();
    for (let i = 0; i < N; i++) {
      const r = D.wRoot[i], l = D.wLemma[i];
      if (r < 0 || l < 0) continue;
      let m = rootLemmas.get(r);
      if (!m) rootLemmas.set(r, (m = new Map()));
      m.set(l, (m.get(l) || 0) + 1);
    }
    for (const [r, m] of rootLemmas) {
      D.rootGloss[r] = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
        .map(([l]) => D.lemmaGloss[l]).filter(Boolean).filter((g, i, a) => a.indexOf(g) === i).join(", ");
    }

    // Base rates for comparisons.
    D.medinanWords = 0;
    D.medinanVerses = 0;
    for (let v = 0; v < V; v++) {
      if (D.surahs[D.verseSurah[v] - 1].type === "medinan") { D.medinanVerses++; D.medinanWords += D.verseLen[v]; }
    }
    D.surahWords = D.surahs.map((s, i) => D.surahFirstWord[i + 1] - D.surahFirstWord[i]);

    // Last letter of each verse, for the rhyme shading.
    D.verseRhyme = new Array(V);
    for (let v = 0; v < V; v++) {
      const p = D.plainN[D.verseFirst[v + 1] - 1];
      D.verseRhyme[v] = p ? p[p.length - 1] : "";
    }
  }

  // "(of) the month" -> "month": the gloss without articles and particles, for suggestions.
  function simpleGloss(g) {
    return g.replace(/\b(the|a|an|of|to|in|and|for|is|are|was|were|be|by|on|with|from|at|o)\b/g, " ").replace(/\s+/g, " ").trim();
  }

  // ------------------------------------------------------------------ query engine
  // Mirrors scripts/query.py. Change both together.
  const WORD_KEYS = new Set(["root", "lemma", "ar", "en", "pos", "tag", "at"]);
  const VERSE_KEYS = new Set(["tr", "surah", "juz", "page", "ref", "type", "sajdah", "has"]);
  const REF = /^[0-9]+:[0-9]+(-[0-9]+)?$/;

  // One kind of space, ASCII digits (same as query.canonical).
  const canonical = q => q.replace(/[\s\x1c-\x1f\x85]/g, " ")
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x6F0));

  function parse(query) {
    const groups = [];
    for (const raw of canonical(query).split("|")) {
      if (!raw.trim()) continue;
      const terms = [];
      const token = /(-?)(?:(\w+):"([^"]*)"|(\w+):(\S+)|"([^"]*)"|(\S+))/g;
      let m;
      while ((m = token.exec(raw))) {
        const neg = m[1] === "-";
        let key, value;
        if (m[2] !== undefined) { key = m[2].toLowerCase(); value = m[3]; }
        else if (m[4] !== undefined && /^[0-9]+$/.test(m[4])) { key = "ref"; value = `${m[4]}:${m[5]}`; }
        else if (m[4] !== undefined) { key = m[4].toLowerCase(); value = m[5]; }
        else if (m[6] !== undefined) { key = "en"; value = m[6]; }
        else { key = bareKey(m[7]); value = m[7]; }
        if (!WORD_KEYS.has(key) && !VERSE_KEYS.has(key)) throw new QueryError(`unknown key “${key}”. Open “How to search” for the list.`);
        terms.push({ neg, key, value });
      }
      if (terms.length) groups.push(terms);
    }
    if (!groups.length) throw new QueryError("empty search");
    return groups;
  }

  function bareKey(token) {
    if (REF.test(token)) return "ref";
    if (ARABIC.test(token)) return D.rootSetN.has(normalizeAr(token)) ? "root" : "ar";
    return "en";
  }

  const alternatives = (key, value) => {
    const alts = value.split(",").map(v => v.trim()).filter(Boolean);
    if (!alts.length) throw new QueryError(`${key}: is empty`);
    return alts;
  };

  function idMask(table, alts) {
    const want = new Set(alts.map(normalizeAr));
    const mask = new Uint8Array(table.length);
    table.forEach((x, i) => { if (want.has(x)) mask[i] = 1; });
    return mask;
  }

  function wordTest(key, value) {
    const alts = alternatives(key, value);
    if (key === "root" || key === "lemma") {
      let mask;
      if (key === "root") mask = idMask(D.rootsN, alts);
      else {
        // lemma:=x is the vowelled dictionary form exactly; plain lemma: ignores marks.
        mask = idMask(D.lemmasN, alts.filter(v => !v.startsWith("=")));
        const exact = new Set(alts.filter(v => v.startsWith("=")).map(v => v.slice(1).replace(FORMAT, "")));
        D.lemmasExact.forEach((x, i) => { if (exact.has(x)) mask[i] = 1; });
      }
      const main = key === "root" ? D.wRoot : D.wLemma;
      const extra = key === "root" ? D.extraRoots : D.extraLemmas;
      return i => (main[i] >= 0 && mask[main[i]] === 1) || (extra.has(i) && extra.get(i).some(r => mask[r] === 1));
    }
    if (key === "ar") {
      // Both the plain and the Uthmani spelling of each word.
      const exact = new Set(alts.filter(v => v.startsWith("=")).map(v => normalizeAr(v.slice(1))));
      const contains = alts.filter(v => !v.startsWith("=")).map(normalizeAr).filter(Boolean);
      return i => {
        const p = D.plainN[i], u = D.uthN[i];
        return exact.has(p) || exact.has(u) || contains.some(c => p.includes(c) || u.includes(c));
      };
    }
    if (key === "en") {
      const rxs = alts.map(a => phraseRegex(a));
      return i => rxs.some(rx => rx.test(D.glossC[i]));
    }
    if (key === "pos") {
      const want = new Set(alts.map(v => v.toUpperCase()));
      for (const w of want) if (!["N", "V", "P"].includes(w)) throw new QueryError("pos: expects N, V or P");
      return i => want.has(D.pos[i]);
    }
    if (key === "tag") {
      const want = alts.map(v => v.toUpperCase());
      return i => { const t = D.tagsets[D.wTags[i]]; return want.some(w => t.has(w)); };
    }
    if (key === "at") {
      const want = new Set(alts.map(v => v.toLowerCase()));
      for (const w of want) if (w !== "first" && w !== "last") throw new QueryError("at: expects first or last");
      return i => {
        const v = D.wordVerse[i];
        return (want.has("first") && i === D.verseFirst[v]) || (want.has("last") && i === D.verseFirst[v + 1] - 1);
      };
    }
    throw new QueryError(key);
  }

  function numberRanges(value, key) {
    return value.split(",").map(part => {
      const m = /^([0-9]{1,6})(?:-([0-9]{1,6}))?$/.exec(part.trim());
      if (!m) throw new QueryError(`${key}: expects numbers or ranges like 1-10, got “${part}”`);
      return [+m[1], +(m[2] || m[1])];
    });
  }

  const hasCache = new Map();
  function verseTest(key, value) {
    if (key === "tr") {
      const rxs = alternatives(key, value).map(x => phraseRegex(x));
      return v => rxs.some(rx => rx.test(D.verseEnC[v]));
    }
    if (key === "surah" || key === "juz" || key === "page") {
      const ranges = numberRanges(value, key);
      const field = key === "surah" ? D.verseSurah : key === "juz" ? D.verseJuz : D.versePage;
      return v => ranges.some(([lo, hi]) => field[v] >= lo && field[v] <= hi);
    }
    if (key === "ref") {
      const want = value.split(",").map(part => {
        const m = /^([0-9]{1,6}):([0-9]{1,6})(?:-([0-9]{1,6}))?$/.exec(part.trim());
        if (!m) throw new QueryError(`ref: expects 2:255 or 2:255-257, got “${part}”`);
        return [+m[1], +m[2], +(m[3] || m[2])];
      });
      return v => want.some(([s, lo, hi]) => D.verseSurah[v] === s && D.verseAyah[v] >= lo && D.verseAyah[v] <= hi);
    }
    if (key === "type") {
      const want = new Set(alternatives(key, value).map(x => x.toLowerCase()));
      for (const w of want) if (w !== "meccan" && w !== "medinan") throw new QueryError("type: expects meccan or medinan");
      return v => want.has(D.surahs[D.verseSurah[v] - 1].type);
    }
    if (key === "sajdah") {
      const want = value.trim().toLowerCase();
      if (want !== "yes" && want !== "no") throw new QueryError("sajdah: expects yes or no");
      return v => D.sajdah.has(v) === (want === "yes");
    }
    if (key === "has") {
      if (!hasCache.has(value)) {
        const inner = parse(value);
        if (inner.length !== 1 || inner[0].length !== 1 || !WORD_KEYS.has(inner[0][0].key)) {
          throw new QueryError("has: expects one word term, like has:\"root:شمس\"");
        }
        const { neg, key: k, value: val } = inner[0][0];
        const test = wordTest(k, val);
        const found = new Uint8Array(D.V);
        for (let i = 0; i < D.N; i++) if (test(i) !== neg) found[D.wordVerse[i]] = 1;
        hasCache.set(value, found);
      }
      const found = hasCache.get(value);
      return v => found[v] === 1;
    }
    throw new QueryError(key);
  }

  const runCache = new Map();
  function run(query) {
    const key = query.trim();
    if (runCache.has(key)) return runCache.get(key);
    const groups = parse(key);
    const results = groups.map(terms => {
      const wterms = terms.filter(t => WORD_KEYS.has(t.key)).map(t => [t.neg, wordTest(t.key, t.value)]);
      const vterms = terms.filter(t => VERSE_KEYS.has(t.key)).map(t => [t.neg, verseTest(t.key, t.value)]);
      const vok = v => vterms.every(([neg, t]) => t(v) !== neg);
      const hits = [];
      if (wterms.length) {
        for (let i = 0; i < D.N; i++) if (wterms.every(([neg, t]) => t(i) !== neg) && vok(D.wordVerse[i])) hits.push(i);
        return { level: "word", hits };
      }
      for (let v = 0; v < D.V; v++) if (vok(v)) hits.push(v);
      return { level: "verse", hits };
    });
    let out;
    if (results.every(r => r.level === "word")) {
      out = { level: "word", hits: Int32Array.from(new Set(results.flatMap(r => r.hits))).sort(), groups };
    } else {
      const vs = new Set();
      for (const r of results) for (const h of r.hits) vs.add(r.level === "word" ? D.wordVerse[h] : h);
      out = { level: "verse", hits: Int32Array.from(vs).sort(), groups };
    }
    if (runCache.size > 300) runCache.clear();
    runCache.set(key, out);
    return out;
  }

  // ------------------------------------------------------------------ describing queries
  const TAG_NAMES = {
    PN: "proper names", ADJ: "adjectives", PRON: "pronouns", DEM: "demonstratives", REL: "relative pronouns",
    NEG: "negative particles", CONJ: "conjunctions", DET: "words with the article al-", INL: "disconnected letters",
    VOC: "words of address (O …)", INTG: "question words", COND: "conditional words", EMPH: "emphasis particles",
    PERF: "past-tense verbs", IMPF: "present-tense verbs", IMPV: "commands", PASS: "passive verbs", VN: "verbal nouns",
    ACT_PCPL: "active participles", PASS_PCPL: "passive participles", T: "time words", LOC: "place words",
    M: "masculine words", F: "feminine words", MS: "masculine singular words", MD: "masculine dual words",
    MP: "masculine plural words", FS: "feminine singular words", FD: "feminine dual words", FP: "feminine plural words",
    P: "prepositions", CERT: "particles of certainty", FUT: "future particles", RES: "restriction particles",
  };
  const POS_NAMES = { N: "nouns", V: "verbs", P: "particles" };

  const list = v => v.split(",").map(x => x.trim()).filter(Boolean);
  function describeTerm(t) {
    const v = t.value;
    let s;
    switch (t.key) {
      case "root": s = `words from the root ${v.split(",").map(spaced).join(" or ")}`; break;
      case "ar": s = list(v).map(x => (x.startsWith("=") ? `the word ${x.slice(1)}` : `words spelled with ${x}`)).join(" or "); break;
      case "en": s = `words meaning ${list(v).map(x => `“${x}”`).join(" or ")}`; break;
      case "tr": s = `verses whose translation says ${list(v).map(x => `“${x}”`).join(" or ")}`; break;
      case "lemma": s = `forms of ${list(v).map(x => x.replace(/^=/, "")).join(" or ")}`; break;
      case "pos": s = v.split(",").map(x => POS_NAMES[x.toUpperCase()] || x).join(" or "); break;
      case "tag": s = v.split(",").map(x => TAG_NAMES[x.toUpperCase()] || `words tagged ${x.toUpperCase()}`).join(" or "); break;
      case "at": s = `the ${v} word of each verse`; break;
      case "surah": s = /^[0-9]+$/.test(v) && D.surahs[+v - 1] ? `in Surah ${v} ${D.surahs[+v - 1].name}` : `in surahs ${list(v).join(", ")}`; break;
      case "juz": s = `in juz ${list(v).join(", ")}`; break;
      case "page": s = `on page ${list(v).join(", ")}`; break;
      case "ref": s = `${list(v).length > 1 ? "verses" : "verse"} ${list(v).join(", ")}`; break;
      case "type": s = `in ${v.split(",").map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(" or ")} surahs`; break;
      case "sajdah": s = /^\s*no\s*$/i.test(v) ? "verses without a prostration" : "the verses of prostration"; break;
      case "has": s = `verses containing ${(() => { try { return describeTerm(parse(v)[0][0]); } catch (_) { return v; } })()}`; break;
      default: s = `${t.key}:${v}`;
    }
    return (t.neg ? "not " : "") + s;
  }
  function describe(groups) {
    return groups.map(terms => terms.map(describeTerm).join(", ")).join(" or ");
  }

  // ------------------------------------------------------------------ state
  const SERIES = [
    { color: "#ffffff", shape: "circle", name: "white circles" },
    { color: "#e8692e", shape: "diamond", name: "orange diamonds" },
    { color: "#3f8fe8", shape: "square", name: "blue squares" },
  ];
  const ALLOWED = {
    unit: ["words", "verses", "pages"],
    dir: ["rtl", "ltr"],
    order: ["mushaf", "revelation"],
    shade: ["none", "surahs", "type", "length", "revelation", "juz", "rhyme"],
  };
  const view = { unit: "words", dir: "rtl", order: "mushaf", shade: "none", connect: false };
  try {
    const saved = JSON.parse(localStorage.getItem("quran-grid-view") || "{}");
    for (const k of Object.keys(view)) {
      if (!(k in saved) || typeof saved[k] !== typeof view[k]) continue;
      if (ALLOWED[k] && !ALLOWED[k].includes(saved[k])) continue;
      view[k] = saved[k];
    }
  } catch (_) { /* storage unavailable */ }
  function saveView() {
    try { localStorage.setItem("quran-grid-view", JSON.stringify(view)); } catch (_) { /* ignore */ }
  }

  // Search series: [{q, label}], at most 3. results: [{level, hits, error}]
  let series = [];
  let results = [];
  let activeDiscovery = null;
  let catalogLimit = 25;
  let distMode = "count";

  // ------------------------------------------------------------------ sequences & cells
  const seqCache = {};
  function sequence(order) {
    if (seqCache[order]) return seqCache[order];
    const seq = D.surahs.map(s => s.n);
    if (order === "revelation") seq.sort((a, b) => D.surahs[a - 1].rev - D.surahs[b - 1].rev);
    const wordStart = [0], verseStart = [0];
    const rank = new Int32Array(115);
    seq.forEach((n, k) => {
      rank[n] = k;
      wordStart.push(wordStart[k] + D.surahWords[n - 1]);
      verseStart.push(verseStart[k] + D.surahs[n - 1].verses);
    });
    return (seqCache[order] = { order, seq, wordStart, verseStart, rank });
  }
  const unitSize = unit => (unit === "words" ? D.N : unit === "verses" ? D.V : D.pageStart.length);

  function wordCell(i, seq) {
    const s = D.verseSurah[D.wordVerse[i]];
    return seq.wordStart[seq.rank[s]] + (i - D.surahFirstWord[s - 1]);
  }
  function verseCell(v, seq) {
    const s = D.verseSurah[v];
    return seq.verseStart[seq.rank[s]] + (v - D.surahFirstVerse[s - 1]);
  }
  // Cell of a hit (a word or a verse index) in the current unit.
  function hitCell(level, h, unit, seq) {
    const v = level === "word" ? D.wordVerse[h] : h;
    if (unit === "pages") return D.versePage[v] - 1;
    if (unit === "verses") return verseCell(v, seq);
    return wordCell(level === "word" ? h : D.verseFirst[v], seq);
  }
  // Position through the whole text (0..1) in the current order, by words.
  function hitFraction(level, h, seq) {
    return wordCell(level === "word" ? h : D.verseFirst[h], seq) / D.N;
  }

  const verseRef = v => `${D.verseSurah[v]}:${D.verseAyah[v]}`;
  const surahName = n => D.surahs[n - 1].name;

  // What a cell holds: {word} | {verse} | {page, from, to}
  function cellInfo(idx, unit, seq) {
    if (idx < 0 || idx >= unitSize(unit)) return null;
    if (unit === "words") {
      const k = upperBound(seq.wordStart, idx) - 1;
      const s = seq.seq[k];
      return { word: D.surahFirstWord[s - 1] + (idx - seq.wordStart[k]) };
    }
    if (unit === "verses") {
      const k = upperBound(seq.verseStart, idx) - 1;
      const s = seq.seq[k];
      return { verse: D.surahFirstVerse[s - 1] + (idx - seq.verseStart[k]) };
    }
    const from = D.pageStart[idx];
    const to = (idx + 1 < D.pageStart.length ? D.pageStart[idx + 1] : D.V) - 1;
    return { page: idx + 1, from, to };
  }
  function cellVerse(info) {
    return info.word != null ? D.wordVerse[info.word] : info.verse != null ? info.verse : info.from;
  }

  // ------------------------------------------------------------------ shading
  const SHADE = {
    field: [20, 20, 18], band: [35, 34, 31],
    meccan: [20, 20, 18], medinan: [54, 52, 47],
    rampLo: [14, 14, 13], rampHi: [86, 82, 75],
  };
  const RHYME = [
    ["ن", "n", [24, 46, 74]], ["ا", "ā", [27, 66, 52]], ["م", "m", [80, 46, 26]], ["ر", "r", [76, 62, 18]],
    ["ي", "ī", [78, 36, 62]], ["د", "d", [52, 44, 92]], ["ه", "h", [86, 34, 34]], ["ب", "b", [30, 68, 82]],
  ];
  const RHYME_OTHER = [34, 33, 30];
  const RHYME_MAP = new Map(RHYME.map(([l, , c]) => [l, c]));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));

  function verseShade(v, seq) {
    switch (view.shade) {
      case "surahs": return D.verseSurah[v] % 2 ? SHADE.field : SHADE.band;
      case "juz": return D.verseJuz[v] % 2 ? SHADE.field : SHADE.band;
      case "type": return D.surahs[D.verseSurah[v] - 1].type === "medinan" ? SHADE.medinan : SHADE.meccan;
      case "length": return mix(SHADE.rampLo, SHADE.rampHi, Math.log(D.verseLen[v]) / Math.log(128));
      case "revelation": return mix(SHADE.rampLo, SHADE.rampHi, (D.surahs[D.verseSurah[v] - 1].rev - 1) / 113);
      case "rhyme": return RHYME_MAP.get(D.verseRhyme[v]) || RHYME_OTHER;
      default: return SHADE.field;
    }
  }

  function renderLegend() {
    const lg = $("legend");
    lg.replaceChildren();
    const sw = c => { const s = el("span", "sw"); s.style.background = rgb(c); return s; };
    const item = (c, text) => { const s = el("span"); s.append(sw(c), text); return s; };
    const ramp = (lo, hi) => { const s = el("span", "ramp"); s.style.background = `linear-gradient(90deg, ${rgb(lo)}, ${rgb(hi)})`; return s; };
    switch (view.shade) {
      case "surahs": lg.append(item(SHADE.field, "odd-numbered surahs"), item(SHADE.band, "even-numbered surahs")); break;
      case "juz": lg.append(item(SHADE.field, "odd-numbered juz"), item(SHADE.band, "even-numbered juz")); break;
      case "type": lg.append(item(SHADE.meccan, `Meccan surahs (${D.surahs.filter(s => s.type === "meccan").length})`), item(SHADE.medinan, `Medinan surahs (${D.surahs.filter(s => s.type === "medinan").length})`)); break;
      case "length": { const s = el("span"); s.append("1 word", ramp(SHADE.rampLo, SHADE.rampHi), "128 words per verse (log scale)"); lg.append(s); break; }
      case "revelation": { const s = el("span"); s.append("revealed first", ramp(SHADE.rampLo, SHADE.rampHi), "revealed last (by surah)"); lg.append(s); break; }
      case "rhyme": {
        const counts = new Map();
        for (const r of D.verseRhyme) counts.set(r, (counts.get(r) || 0) + 1);
        for (const [l, tr, c] of RHYME) {
          const s = el("span");
          s.append(sw(c), arSpan(l), ` ${tr} · ${fmt.format(counts.get(l) || 0)}`);
          lg.append(s);
        }
        const others = D.V - RHYME.reduce((a, [l]) => a + (counts.get(l) || 0), 0);
        lg.append(item(RHYME_OTHER, `other letters · ${fmt.format(others)}`));
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ view model
  let model = null;
  function buildModel() {
    const unit = view.unit;
    const seq = sequence(unit === "pages" ? "mushaf" : view.order);
    const n = unitSize(unit);
    const { cols, rows } = gridShape(n);
    const layers = results.map((r, k) => {
      const cells = new Map();
      if (r && !r.error) {
        for (const h of r.hits) {
          const c = hitCell(r.level, h, unit, seq);
          if (!cells.has(c)) cells.set(c, []);
          cells.get(c).push(h);
        }
      }
      return { k, level: r && r.level, cells };
    });
    const totalCells = layers.reduce((a, l) => a + l.cells.size, 0);
    model = { unit, seq, n, cols, rows, layers, dense: totalCells > 420 };
  }

  // ------------------------------------------------------------------ drawing
  const canvas = $("grid");
  const ctx = canvas.getContext("2d");
  const box = $("grid-box");
  const tooltip = $("tooltip");
  const strip = $("strip");
  const sctx = strip.getContext("2d");
  let geo = null;
  let hover = null;          // {idx} cell index under the pointer
  let focusVerse = null;     // verse index highlighted from the list
  let fieldCache = { key: "", canvas: null };

  // Canvas position of a cell. The grid sits inside a margin of geo.pad so dots
  // in the outer rows and columns are not cut off.
  function cellXY(idx) {
    const row = Math.floor(idx / geo.cols);
    let col = idx - row * geo.cols;
    if (view.dir === "rtl") col = geo.cols - 1 - col;
    return { x: geo.pad + (col + 0.5) * geo.cell, y: geo.pad + (row + 0.5) * geo.cell, row, col };
  }

  function fieldImage() {
    const key = [model.unit, model.seq.order, view.dir, view.shade].join("|");
    if (fieldCache.key === key) return fieldCache.canvas;
    const { cols, rows, n, unit, seq } = model;
    const off = document.createElement("canvas");
    off.width = cols; off.height = rows;
    const octx = off.getContext("2d");
    const img = octx.createImageData(cols, rows);
    for (let i = 0; i < n; i++) {
      const info = cellInfo(i, unit, seq);
      const c = verseShade(cellVerse(info), seq);
      const row = (i / cols) | 0;
      let col = i - row * cols;
      if (view.dir === "rtl") col = cols - 1 - col;
      const p = (row * cols + col) * 4;
      img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    fieldCache = { key, canvas: off };
    return off;
  }

  function drawShape(c, shape, x, y, r) {
    c.beginPath();
    if (shape === "diamond") {
      const d = r * 1.25;
      c.moveTo(x, y - d); c.lineTo(x + d, y); c.lineTo(x, y + d); c.lineTo(x - d, y); c.closePath();
    } else if (shape === "square") {
      const d = r * 0.9;
      c.rect(x - d, y - d, d * 2, d * 2);
    } else {
      c.arc(x, y, r, 0, Math.PI * 2);
    }
  }

  // Dots closer than their own width read as one: group them so a group with more
  // than one match gets a ring and one shared tooltip.
  function groupMarks(marks, r) {
    const parent = marks.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        if (Math.hypot(marks[i].x - marks[j].x, marks[i].y - marks[j].y) < 2 * r + 1) parent[find(j)] = find(i);
      }
    }
    const by = new Map();
    marks.forEach((m, i) => { const k = find(i); if (!by.has(k)) by.set(k, []); by.get(k).push(m); });
    return [...by.values()].map(ms => {
      const x = ms.reduce((a, m) => a + m.x, 0) / ms.length;
      const y = ms.reduce((a, m) => a + m.y, 0) / ms.length;
      return { x, y, spread: Math.max(...ms.map(m => Math.hypot(m.x - x, m.y - y))), count: ms.reduce((a, m) => a + m.hits.length, 0) };
    });
  }

  function markRadius(cell) {
    return model.dense ? Math.max(1.3, Math.min(cell * 0.62, 6)) : Math.min(11, Math.max(3.5, cell * 0.38));
  }

  function resize() {
    if (!model) return;
    const width = Math.max(200, Math.floor(box.clientWidth));
    const pad = Math.ceil(markRadius(width / model.cols) * 1.3) + 2;
    const cell = (width - 2 * pad) / model.cols;
    const height = Math.ceil(cell * model.rows + 2 * pad);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + "px";
    geo = { width, height, cell, pad, dpr, cols: model.cols, rows: model.rows, r: markRadius(cell) };
    drawBase();
    draw();
    drawStrip();
  }

  // Everything that does not change on hover: the field, lines, dots and rings.
  // Drawn once per render into an offscreen canvas; hover only adds highlights.
  function drawBase() {
    const { width, height, cell, pad, dpr, r } = geo;
    const base = document.createElement("canvas");
    base.width = canvas.width;
    base.height = canvas.height;
    const c = base.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#000";
    c.fillRect(0, 0, width, height);

    if (cell >= 6) {
      const gap = Math.max(1, cell * 0.1);
      for (let i = 0; i < model.n; i++) {
        const p = cellXY(i);
        c.fillStyle = rgb(verseShade(cellVerse(cellInfo(i, model.unit, model.seq)), model.seq));
        c.fillRect(pad + p.col * cell + gap / 2, pad + p.row * cell + gap / 2, cell - gap, cell - gap);
      }
    } else {
      c.imageSmoothingEnabled = false;
      c.drawImage(fieldImage(), pad, pad, model.cols * cell, model.rows * cell);
    }

    const marks = [];
    for (let k = model.layers.length - 1; k >= 0; k--) {
      const layer = model.layers[k];
      const st = SERIES[k];
      const list = [...layer.cells.keys()].sort((a, b) => a - b).map(idx => ({ idx, ...cellXY(idx), hits: layer.cells.get(idx), k }));
      if (!list.length) continue;
      if (view.connect && list.length > 1) {
        c.strokeStyle = st.color;
        c.globalAlpha = 0.45;
        c.lineWidth = 1;
        c.lineJoin = "round";
        c.beginPath();
        list.forEach((m, i) => (i ? c.lineTo(m.x, m.y) : c.moveTo(m.x, m.y)));
        c.stroke();
        c.globalAlpha = 1;
      }
      if (!model.dense) {
        for (const m of list) {
          const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 3.2);
          g.addColorStop(0, k === 0 ? "rgba(255,255,255,0.3)" : hexAlpha(st.color, 0.35));
          g.addColorStop(1, "rgba(0,0,0,0)");
          c.fillStyle = g;
          c.beginPath(); c.arc(m.x, m.y, r * 3.2, 0, Math.PI * 2); c.fill();
        }
      }
      c.fillStyle = st.color;
      // Coloured markers get a thin black keyline so they keep their contrast on light shading.
      const keyline = k > 0 && !model.dense;
      c.strokeStyle = "#000";
      c.lineWidth = 1;
      for (const m of list) {
        drawShape(c, st.shape, m.x, m.y, r);
        c.fill();
        if (keyline) c.stroke();
      }
      if (!model.dense) {
        c.strokeStyle = st.color;
        c.lineWidth = 1.3;
        for (const g of groupMarks(list, r)) {
          if (g.count < 2) continue;
          c.beginPath(); c.arc(g.x, g.y, g.spread + r + 3.5, 0, Math.PI * 2); c.stroke();
        }
      }
      marks.push(...list);
    }
    geo.marks = marks;
    geo.base = base;
  }

  function draw() {
    if (!geo || !geo.base) return;
    const { cell, r } = geo;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(geo.base, 0, 0);
    ctx.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);

    // Highlights: the verse focused in the list, then the square under the pointer.
    if (focusVerse != null) {
      const seen = new Set();
      for (const m of geo.marks) {
        if (seen.has(m.idx)) continue;
        const info = cellInfo(m.idx, model.unit, model.seq);
        const covers = info.page ? (focusVerse >= info.from && focusVerse <= info.to) : cellVerse(info) === focusVerse;
        if (covers) { seen.add(m.idx); ring(m.x, m.y, r + 8, 0.9); }
      }
    }
    if (hover) {
      const p = cellXY(hover.idx);
      if (hover.mark) ring(p.x, p.y, r + 6, 0.95);
      else {
        const sz = Math.max(cell, 6);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - sz / 2 + 0.5, p.y - sz / 2 + 0.5, sz - 1, sz - 1);
      }
    }
  }
  function ring(x, y, rad, alpha) {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
  }
  function hexAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function drawStrip() {
    const lanes = Math.max(1, results.length);
    const laneH = 26;
    const height = lanes * laneH + 8;
    const width = Math.max(200, Math.floor(strip.clientWidth));
    const dpr = geo.dpr;
    strip.width = Math.round(width * dpr);
    strip.height = Math.round(height * dpr);
    strip.style.height = height + "px";
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.fillStyle = "#000";
    sctx.fillRect(0, 0, width, height);
    const pad = 8;
    const X = f => (view.dir === "rtl" ? width - pad - f * (width - 2 * pad) : pad + f * (width - 2 * pad));
    const seq = model.seq;
    results.forEach((r, k) => {
      const y = 4 + k * laneH + laneH / 2;
      sctx.fillStyle = "#262522";
      for (let s = 1; s < seq.wordStart.length - 1; s++) sctx.fillRect(Math.round(X(seq.wordStart[s] / D.N)), y - 5, 1, 10);
      sctx.fillStyle = "#85817a";
      sctx.fillRect(pad, y, width - 2 * pad, 1);
      if (!r || r.error) return;
      const st = SERIES[k];
      sctx.fillStyle = st.color;
      const rad = r.hits.length > 400 ? 1.6 : 3.2;
      if (r.hits.length > 400) sctx.globalAlpha = 0.6;
      for (const h of r.hits) { drawShape(sctx, st.shape, X(hitFraction(r.level, h, seq)), y + 0.5, rad); sctx.fill(); }
      sctx.globalAlpha = 1;
    });
  }

  // ------------------------------------------------------------------ text around the grid
  function endsText() {
    const label = info => {
      if (info.page) return `page ${info.page}`;
      const v = cellVerse(info);
      return `${verseRef(v)} ${surahName(D.verseSurah[v])}`;
    };
    return { start: label(cellInfo(0, model.unit, model.seq)), end: label(cellInfo(model.n - 1, model.unit, model.seq)) };
  }

  function renderEnds() {
    const { start, end } = endsText();
    const { cols, rows, n } = model;
    const empty = cols * rows - n;
    const rtl = view.dir === "rtl";
    const size = el("span", "", `${cols} columns × ${rows} rows`);
    const begin = el("span", "mark", rtl ? `Start · ${start} ←` : `Start · ${start} →`);
    $("ends-top").replaceChildren(begin, size);
    $("ends-top").style.flexDirection = rtl ? "row-reverse" : "row";
    const finish = el("span", "", `End · ${end}${empty ? `, then ${empty} empty square${empty === 1 ? "" : "s"}` : ""}`);
    $("ends-bottom").replaceChildren(finish, el("span"));
    $("ends-bottom").style.flexDirection = rtl ? "row-reverse" : "row";
    const s1 = el("span", "", `Start · ${start}`), s2 = el("span", "", `End · ${end}`);
    $("strip-ends").replaceChildren(s1, s2);
    $("strip-ends").style.flexDirection = rtl ? "row-reverse" : "row";
    const unitWord = { words: "word", verses: "verse", pages: "page" }[model.unit];
    const how = model.unit === "pages" ? "the 604 pages of the Madani mushaf" : view.order === "revelation" ? "surahs in revelation order" : "surahs in their standard order";
    $("caption").textContent = `1 square = 1 ${unitWord} · ${how}. Hover or tap any square to see what it holds; tap a dot to open its verse.`;
    const total = results.reduce((a, r) => a + (r && !r.error ? r.hits.length : 0), 0);
    canvas.setAttribute("aria-label", `Grid of ${fmt.format(n)} ${unitWord}s with ${fmt.format(total)} matches marked. Use the arrow keys to step through the matches and Enter to open a verse. The verse list below has every match.`);
  }

  function markerSvg(k, size) {
    const s = size || 14;
    const svg = svgEl("svg", { width: s, height: s, viewBox: "0 0 14 14", "aria-hidden": "true" });
    const st = SERIES[k];
    let shape;
    if (st.shape === "diamond") shape = svgEl("path", { d: "M7 1.5 L12.5 7 L7 12.5 L1.5 7 Z", fill: st.color });
    else if (st.shape === "square") shape = svgEl("rect", { x: 2.5, y: 2.5, width: 9, height: 9, fill: st.color });
    else shape = svgEl("circle", { cx: 7, cy: 7, r: 4.6, fill: st.color });
    svg.append(shape);
    return svg;
  }

  // The label as it was when the search ran, not what is being typed now.
  function seriesLabel(k) {
    const r = results[k];
    return (r && r.label) || (series[k] && (series[k].label || series[k].q)) || "";
  }

  function renderNotes() {
    const notes = $("notes");
    notes.replaceChildren();
    results.forEach((r, k) => {
      if (!r) return;
      const box = el("div", "s-note");
      const head = el("div", "s-head");
      head.append(markerSvg(k, 18), elB("span", "lbl", seriesLabel(k)));
      box.append(head);
      if (!r || r.error) { box.append(el("p", "empty-note", r ? r.error : "")); notes.append(box); return; }
      const n = r.hits.length;
      const verses = new Set(), surahs = new Map();
      let med = 0;
      for (const h of r.hits) {
        const v = r.level === "word" ? D.wordVerse[h] : h;
        verses.add(v);
        const s = D.verseSurah[v];
        surahs.set(s, (surahs.get(s) || 0) + 1);
        if (D.surahs[s - 1].type === "medinan") med++;
      }
      const big = el("div");
      big.append(el("div", "big", fmt.format(n)));
      big.append(el("div", "big-sub", r.level === "word"
        ? `${n === 1 ? "word" : "words"} in ${plural(verses.size, "verse")}, across ${plural(surahs.size, "surah")}`
        : `${n === 1 ? "verse" : "verses"} across ${plural(surahs.size, "surah")}`));
      box.append(big);
      if (!n) { box.append(el("p", "empty-note", "No matches. Try a shorter word, a root, or “How to search”.")); notes.append(box); return; }

      const base = r.level === "word" ? D.medinanWords / D.N : D.medinanVerses / D.V;
      const split = el("div", "split");
      const bar = el("div", "split-bar");
      const a = el("span", "mec"); a.style.width = `${100 - pct(med, n)}%`;
      const b = el("span", "med"); b.style.width = `${pct(med, n)}%`;
      bar.append(a, b);
      const row = el("div", "row");
      row.append(el("span", "", `Meccan ${pct(n - med, n)}%`), el("span", "", `Medinan ${pct(med, n)}%`));
      split.append(bar, row, el("div", "base", `All ${r.level === "word" ? "words" : "verses"}: ${Math.round((1 - base) * 100)}% Meccan, ${Math.round(base * 100)}% Medinan`));
      box.append(split);

      const ordered = [...r.hits].map(h => [h, hitFraction(r.level, h, model.seq)]).sort((x, y) => x[1] - y[1]);
      const refOf = h => (r.level === "word" ? verseRef(D.wordVerse[h]) : verseRef(h));
      const top = [...surahs.entries()].sort((x, y) => y[1] - x[1])[0];
      const third = ordered.filter(([, f]) => f < 1 / 3).length;
      const facts = el("dl", "facts");
      const fact = (dt, dd) => facts.append(el("dt", "", dt), el("dd", "", dd));
      fact("First", refOf(ordered[0][0]));
      fact("Last", refOf(ordered[ordered.length - 1][0]));
      fact("Most in", `${surahName(top[0])} (${top[0]}) · ${fmt.format(top[1])}`);
      fact("First third", `${fmt.format(third)} of ${fmt.format(n)} (${pct(third, n)}%)`);
      box.append(facts);

      if (r.level === "word") {
        const counts = new Map();
        for (const h of r.hits) counts.set(D.plain[h], (counts.get(D.plain[h]) || 0) + 1);
        const sp = el("div", "spellings");
        for (const [w, c] of [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)) {
          const s = el("span");
          const ar = arSpan(w);
          s.append(ar, " ", el("span", "k", fmt.format(c)));
          sp.append(s);
        }
        const lbl = el("p", "mono-label", "Most common spellings");
        lbl.style.margin = "0 0 -4px";
        box.append(lbl, sp);
      }
      notes.append(box);
    });
  }

  // ------------------------------------------------------------------ surah by surah
  function renderDist() {
    const wrap = $("dist");
    wrap.replaceChildren();
    const seq = model.seq;
    const head = $("dist-note");
    const hadFocus = head.contains(document.activeElement);
    head.replaceChildren();
    const seg = el("span", "seg");
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", "Bar height");
    for (const [val, text] of [["count", "count"], ["rate", "per 1,000 words"]]) {
      const id = `dist-${val}`;
      const input = el("input"); input.type = "radio"; input.name = "dist"; input.id = id; input.value = val; input.checked = distMode === val;
      const label = el("label", "", text); label.htmlFor = id;
      seg.append(input, label);
    }
    seg.addEventListener("change", e => { distMode = e.target.value; renderDist(); });
    head.append(`Each bar is one surah, in ${seq.order === "revelation" ? "revelation" : "standard"} order. `, seg);
    if (hadFocus) $(`dist-${distMode}`).focus();

    results.forEach((r, k) => {
      if (!r || r.error) return;
      const per = new Float64Array(115);
      for (const h of r.hits) per[D.verseSurah[r.level === "word" ? D.wordVerse[h] : h]] += 1;
      const vals = seq.seq.map(s => (distMode === "rate" ? (per[s] / D.surahWords[s - 1]) * 1000 : per[s]));
      const max = Math.max(...vals);
      const row = el("div", "dist-row");
      const lbl = el("div", "d-lbl");
      lbl.append(markerSvg(k, 14), elB("span", "", seriesLabel(k)));
      // Bars only in the stretched SVG; labels live in HTML so text never distorts.
      const W = 1140, H = 70;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H + 1}`, preserveAspectRatio: "none", role: "img",
        "aria-label": `${iso(seriesLabel(k))}: matches in each surah, highest ${distMode === "rate" ? max.toFixed(1) + " per 1,000 words" : fmt.format(max)}` });
      svg.style.height = "72px";
      svg.append(svgEl("rect", { x: 0, y: H, width: W, height: 1, fill: "#3a3935" }));
      const bw = W / 114;
      vals.forEach((val, i) => {
        if (!val) return;
        const h = Math.max(1.5, (val / max) * (H - 2));
        const x = view.dir === "rtl" ? W - (i + 1) * bw : i * bw;
        const s = seq.seq[i];
        const rect = svgEl("rect", { class: "bar", x: x + 0.6, y: H - h, width: Math.max(1, bw - 1.2), height: h, fill: SERIES[k].color });
        const t = svgEl("title", {});
        t.textContent = `Surah ${s} ${surahName(s)}: ${distMode === "rate" ? `${val.toFixed(1)} per 1,000 words (${per[s]} in ${fmt.format(D.surahWords[s - 1])} words)` : fmt.format(val)}`;
        rect.append(t);
        svg.append(rect);
      });
      const first = seq.seq[0], last = seq.seq[113];
      const holder = el("div");
      const maxLbl = el("div", "ends axis");
      maxLbl.append(el("span", "", `Highest: ${distMode === "rate" ? max.toFixed(1) + " per 1,000 words" : fmt.format(max)}`));
      const labels = el("div", "ends axis");
      labels.style.marginTop = "4px";
      const a = el("span", "", `Surah ${first}`), b = el("span", "", `Surah ${last}`);
      labels.append(a, b);
      labels.style.flexDirection = view.dir === "rtl" ? "row-reverse" : "row";
      holder.append(maxLbl, svg, labels);
      row.append(lbl, holder);
      wrap.append(row);
    });
    if (!wrap.children.length) wrap.append(el("p", "empty-note", "Nothing to chart yet."));
  }

  // ------------------------------------------------------------------ verses
  const entriesEl = $("entries");
  function trPhrases() {
    const out = [];
    for (const r of results) {
      if (!r || r.error) continue;
      for (const terms of r.groups) for (const t of terms) if (t.key === "tr" && !t.neg) {
        for (const x of t.value.split(",")) if (x.trim()) { try { out.push(phraseRegex(x, "gi")); } catch (_) { /* skip */ } }
      }
    }
    return out;
  }

  function highlightEnglish(text, rxs) {
    if (!rxs.length) return [text];
    // Match on the cleaned text positions: brackets are removed there, so match the raw text loosely.
    const ranges = [];
    for (const rx of rxs) {
      const loose = new RegExp(rx.source.replace(/\\s\+/g, "[\\s()\\[\\]]+"), "gi");
      let m;
      while ((m = loose.exec(text))) { ranges.push([m.index, m.index + m[0].length]); if (!m[0].length) loose.lastIndex++; }
    }
    if (!ranges.length) return [text];
    ranges.sort((a, b) => a[0] - b[0]);
    const out = [];
    let pos = 0;
    for (const [a, b] of ranges) {
      if (a < pos) continue;
      out.push(text.slice(pos, a), el("mark", "", text.slice(a, b)));
      pos = b;
    }
    out.push(text.slice(pos));
    return out;
  }

  function renderCatalog() {
    entriesEl.replaceChildren();
    const more = $("catalog-more");
    more.replaceChildren();
    // verse -> per series: word hits (Set) or true for a verse hit
    const byVerse = new Map();
    results.forEach((r, k) => {
      if (!r || r.error) return;
      for (const h of r.hits) {
        const v = r.level === "word" ? D.wordVerse[h] : h;
        if (!byVerse.has(v)) byVerse.set(v, results.map(() => null));
        const slot = byVerse.get(v);
        if (r.level === "word") { if (!slot[k]) slot[k] = new Set(); slot[k].add(h); }
        else slot[k] = true;
      }
    });
    const seq = model.seq;
    const verses = [...byVerse.keys()].sort((a, b) => verseCell(a, seq) - verseCell(b, seq));
    $("catalog-title").textContent = verses.length ? `The ${plural(verses.length, "verse")}` : "The verses";
    $("catalog-note").textContent = verses.length ? "In the order they appear in the grid. Tap a dot to jump to its verse." : "Nothing matches yet.";
    const rxs = trPhrases();
    for (const v of verses.slice(0, catalogLimit)) entriesEl.append(entryFor(v, byVerse.get(v), rxs));
    if (verses.length > catalogLimit) {
      more.append(`Showing ${fmt.format(catalogLimit)} of ${fmt.format(verses.length)}.`);
      const btn = el("button", "btn", `Show ${fmt.format(Math.min(100, verses.length - catalogLimit))} more`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        const first = catalogLimit;
        catalogLimit += 100;
        renderCatalog();
        if (entriesEl.children[first]) entriesEl.children[first].focus();
      });
      more.append(btn);
    }
    model.catalogOrder = verses;
  }

  function entryFor(v, slots, rxs) {
    const li = el("li", "entry");
    li.id = `v-${D.verseSurah[v]}-${D.verseAyah[v]}`;
    li.tabIndex = 0;
    const s = D.surahs[D.verseSurah[v] - 1];
    const meta = el("div", "meta");
    meta.append(el("div", "ref", verseRef(v)));
    const sn = el("div", "surah");
    const ar = arSpan(s.name_ar);
    sn.append(`${s.name} · `, ar, ` · ${s.name_en}`);
    meta.append(sn);
    const f = (wordCell(D.verseFirst[v], model.seq) / D.N) * 100;
    meta.append(el("div", "where", `${f < 10 ? f.toFixed(1) : Math.round(f)}% through · page ${D.versePage[v]} · ${s.type === "medinan" ? "Medinan" : "Meccan"}`));
    const chips = el("div", "chips");
    slots.forEach((slot, k) => {
      if (!slot) return;
      const c = el("span", "chip");
      c.append(markerSvg(k, 12), slot === true ? "verse matches" : plural(slot.size, "word"));
      chips.append(c);
    });
    meta.append(chips);
    const body = el("div", "body");
    const arP = el("p", "verse-ar");
    arP.lang = "ar";
    arP.dir = "rtl";
    let anyWord = false;
    for (let i = D.verseFirst[v]; i < D.verseFirst[v + 1]; i++) {
      const k = slots.findIndex(sl => sl && sl !== true && sl.has(i));
      if (k >= 0) { arP.append(el("mark", `m${k}`, D.ar[i])); anyWord = true; }
      else arP.append(D.ar[i]);
      if (i < D.verseFirst[v + 1] - 1) arP.append(" ");
    }
    if (!anyWord) arP.classList.add("whole");
    const en = el("p", "verse-en");
    en.append(...highlightEnglish(D.verseEn[v], rxs), " ", el("span", "src", "(Saheeh International)"));
    body.append(arP, en);
    li.append(meta, body);
    li.addEventListener("pointerenter", () => setFocusVerse(v));
    li.addEventListener("pointerleave", () => setFocusVerse(null));
    li.addEventListener("focus", () => setFocusVerse(v));
    li.addEventListener("blur", () => setFocusVerse(null));
    return li;
  }
  function setFocusVerse(v) {
    if (focusVerse === v) return;
    focusVerse = v;
    draw();
  }

  // ------------------------------------------------------------------ tooltip & pointer
  function hitTest(x, y) {
    const { cell, r } = geo;
    let best = null, bestD = model.dense ? Math.max(8, r + 4) : Math.max(14, r + 8);
    for (const m of geo.marks || []) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d <= bestD) { bestD = d; best = m; }
    }
    if (best) return { idx: best.idx, mark: true };
    const row = Math.floor((y - geo.pad) / cell);
    let col = Math.floor((x - geo.pad) / cell);
    if (row < 0 || row >= model.rows || col < 0 || col >= model.cols) return null;
    if (view.dir === "rtl") col = model.cols - 1 - col;
    const idx = row * model.cols + col;
    if (idx >= model.n) return null;
    return { idx, mark: false };
  }

  function cellHeading(info) {
    if (info.page) return `Page ${info.page} · ${verseRef(info.from)} to ${verseRef(info.to)}`;
    const v = cellVerse(info);
    const base = `${surahName(D.verseSurah[v])} ${verseRef(v)}`;
    return info.word != null ? `${base} · word ${info.word - D.verseFirst[v] + 1}` : base;
  }

  function showTooltip(hit, x, y) {
    tooltip.replaceChildren();
    const info = cellInfo(hit.idx, model.unit, model.seq);
    const head = el("div", "t-row");
    head.append(el("div", "t-ref", cellHeading(info)));
    if (info.word != null) {
      const a = el("div", "t-ar", D.ar[info.word]); a.lang = "ar";
      const g = el("div");
      g.append(el("span", "t-strong", D.translit[info.word]), ` · ${D.gloss[info.word]}`);
      head.append(a, g);
    }
    tooltip.append(head);
    let any = false;
    model.layers.forEach((layer, k) => {
      const hits = layer.cells.get(hit.idx);
      if (!hits) return;
      any = true;
      const row = el("div", "t-row");
      const ser = el("div", "t-series");
      ser.append(markerSvg(k, 12), ...bidi(seriesLabel(k)));
      row.append(ser);
      if (layer.level === "word" && info.word == null) {
        const words = hits.slice(0, 3).map(h => D.ar[h]).join(" · ");
        const a = el("div", "t-ar", words); a.lang = "ar";
        row.append(a);
        if (hits.length > 3) row.append(el("div", "t-muted", `and ${hits.length - 3} more`));
        else row.append(el("div", "t-muted", hits.map(h => `${verseRef(D.wordVerse[h])}: ${D.gloss[h]}`).join(" · ")));
      } else if (layer.level === "verse") {
        row.append(el("div", "t-muted", hits.length > 1 ? `${hits.length} matching verses` : "This verse matches"));
      }
      tooltip.append(row);
    });
    if (any) {
      const hint = el("div", "t-muted", lastPointer === "mouse" ? "Click to read the verse"
        : lastPointer === "keyboard" ? "Press Enter to read the verse" : "Tap again to read the verse");
      hint.style.marginTop = "6px";
      tooltip.append(hint);
    }
    tooltip.hidden = false;
    const bw = box.clientWidth, tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    let left = x + 16, top = y + 16;
    if (left + tw > bw) left = Math.max(0, x - tw - 16);
    if (top + th > geo.height) top = Math.max(0, y - th - 16);
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }
  function hideTooltip() {
    tooltip.hidden = true;
    if (hover) { hover = null; draw(); }
  }
  function pointerXY(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (geo.width / rect.width), y: (e.clientY - rect.top) * (geo.height / rect.height) };
  }
  let lastPointer = "mouse", armed = -1, jumpOnClick = false;
  function updateHover(hit, x, y) {
    if (!hit) { hideTooltip(); return; }
    if (!hover || hover.idx !== hit.idx || hover.mark !== hit.mark) { hover = hit; draw(); }
    showTooltip(hit, x, y);
  }
  canvas.addEventListener("pointermove", e => {
    if (!model) return;
    lastPointer = e.pointerType || "mouse";
    if (lastPointer !== "mouse" && e.buttons === 0) return;
    const { x, y } = pointerXY(e);
    updateHover(hitTest(x, y), x, y);
  });
  canvas.addEventListener("pointerdown", e => {
    if (!model) return;
    lastPointer = e.pointerType || "mouse";
    if (lastPointer === "mouse") return;
    const { x, y } = pointerXY(e);
    const hit = hitTest(x, y);
    jumpOnClick = !!hit && hit.mark && armed === hit.idx;
    armed = hit && hit.mark ? hit.idx : -1;
    updateHover(hit, x, y);
  });
  canvas.addEventListener("pointerleave", e => { if ((e.pointerType || "mouse") === "mouse") hideTooltip(); });
  canvas.addEventListener("pointercancel", () => { armed = -1; jumpOnClick = false; hideTooltip(); });
  document.addEventListener("pointerdown", e => { if (e.target !== canvas && !tooltip.hidden) { armed = -1; hideTooltip(); } });
  canvas.addEventListener("click", e => {
    if (!model) return;
    const { x, y } = pointerXY(e);
    const hit = hitTest(x, y);
    if (!hit || !hit.mark) return;
    if (lastPointer !== "mouse" && !jumpOnClick) return;
    armed = -1;
    hideTooltip();
    openCell(hit.idx);
  });
  function openCell(idx) {
    const info = cellInfo(idx, model.unit, model.seq);
    const target = info.page ? model.catalogOrder.find(v => v >= info.from && v <= info.to) : cellVerse(info);
    jumpToVerse(target);
  }

  // Keyboard: arrows step through the dots in reading order, Enter opens the verse.
  canvas.addEventListener("keydown", e => {
    if (!model || !geo || !geo.marks || !geo.marks.length) return;
    const cells = [...new Set(geo.marks.map(m => m.idx))].sort((a, b) => a - b);
    const cur = hover && hover.mark ? cells.indexOf(hover.idx) : -1;
    const forward = view.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = view.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next = null;
    if (e.key === forward || e.key === "ArrowDown") next = cur < 0 ? 0 : Math.min(cells.length - 1, cur + 1);
    else if (e.key === back || e.key === "ArrowUp") next = cur < 0 ? 0 : Math.max(0, cur - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = cells.length - 1;
    else if (e.key === "Enter" && cur >= 0) { e.preventDefault(); hideTooltip(); openCell(cells[cur]); return; }
    else if (e.key === "Escape") { hideTooltip(); return; }
    if (next == null) return;
    e.preventDefault();
    lastPointer = "keyboard";
    hover = { idx: cells[next], mark: true };
    draw();
    const p = cellXY(cells[next]);
    showTooltip(hover, p.x, p.y);
  });
  canvas.addEventListener("blur", () => { if (lastPointer === "keyboard") hideTooltip(); });
  function jumpToVerse(v) {
    if (v == null) return;
    const pos = model.catalogOrder.indexOf(v);
    if (pos < 0) return;
    if (pos >= catalogLimit) { catalogLimit = Math.ceil((pos + 1) / 25) * 25; renderCatalog(); }
    const li = $(`v-${D.verseSurah[v]}-${D.verseAyah[v]}`);
    if (!li) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    li.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    li.classList.add("flash");
    setTimeout(() => li.classList.remove("flash"), 1400);
    li.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ search UI
  const rowsEl = $("series-rows");
  const form = $("search-form");
  let suggestState = { k: -1, items: [], sel: -1 };

  function renderRows() {
    const focused = document.activeElement && document.activeElement.id;
    rowsEl.replaceChildren();
    series.forEach((s, k) => {
      const row = el("div", "series-row");
      const mk = el("span", "marker"); mk.append(markerSvg(k, 18));
      const input = el("input", "q-input");
      input.type = "text";
      input.id = `q-${k}`;
      input.value = s.q;
      input.placeholder = k === 0 ? "Try month, شمس, root:رحم, Musa, tr:\"sacred month\"…" : "Compare with… (sun, قمر, en:star*)";
      input.setAttribute("aria-label", k === 0 ? "Search the Quran" : `Comparison ${k}`);
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-controls", `suggest-${k}`);
      input.spellcheck = false;
      input.addEventListener("input", () => {
        if (!series[k]) return;
        series[k].q = input.value;
        series[k].label = "";
        scheduleSuggest(k);
      });
      input.addEventListener("keydown", e => onKey(e, k));
      input.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== input) closeList(k); }, 150));
      input.addEventListener("focus", () => scheduleSuggest(k));
      row.append(mk, input);
      if (k > 0) {
        const rm = el("button", "icon-btn", "Remove");
        rm.type = "button";
        rm.setAttribute("aria-label", `Remove comparison ${k}`);
        rm.addEventListener("click", () => {
          series.splice(k, 1);
          activeDiscovery = null;
          renderRows();
          search();
          const prev = $(`q-${k - 1}`);
          if (prev) prev.focus();
        });
        row.append(rm);
      } else row.append(el("span"));
      const sug = el("div", "suggest");
      sug.id = `suggest-${k}`;
      sug.setAttribute("role", "listbox");
      sug.setAttribute("aria-label", "Suggestions");
      sug.hidden = true;
      row.append(sug);
      rowsEl.append(row);
    });
    $("add-series").disabled = series.length >= 3;
    if (focused && /^q-\d$/.test(focused) && $(focused)) $(focused).focus();
  }

  let suggestTimer = 0;
  function scheduleSuggest(k) {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => buildSuggest(k), 120);
  }
  function closeList(k) {
    const list = $(`suggest-${k}`), input = $(`q-${k}`);
    if (list) list.hidden = true;
    if (input) { input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
    if (suggestState.k === k) suggestState = { k: -1, items: [], sel: -1 };
  }
  function closeSuggest() {
    clearTimeout(suggestTimer);
    series.forEach((_, k) => closeList(k));
    suggestState = { k: -1, items: [], sel: -1 };
  }
  function buildSuggest(k) {
    if (!D.N) return;
    const input = $(`q-${k}`);
    if (!input || document.activeElement !== input) return;
    input.removeAttribute("aria-activedescendant");
    const text = input.value.trim();
    const items = [];
    if (text.length >= 1 && !/[:|"]/.test(text)) {
      if (ARABIC.test(text)) {
        const t = normalizeAr(text);
        const roots = D.rootsN.map((r, i) => [r, i]).filter(([r]) => r.startsWith(t)).sort((a, b) => D.rootCount[b[1]] - D.rootCount[a[1]]).slice(0, 5);
        for (const [, i] of roots) items.push({ main: [arSpan(D.roots[i]), ` root · ${D.rootGloss[i] || ""}`], q: `root:${D.roots[i]}` });
        const lem = D.lemmasN.map((x, i) => [x, i]).filter(([x]) => x.startsWith(t)).sort((a, b) => D.lemmaCount[b[1]] - D.lemmaCount[a[1]]).slice(0, 6);
        for (const [, i] of lem) items.push({ main: [arSpan(D.lemmas[i]), ` · ${D.lemmaGloss[i] || ""}`], q: `lemma:=${D.lemmas[i]}` });
        items.push({ main: ["Any word spelled with ", arSpan(text)], q: `ar:${text}` });
      } else if (text.length >= 2) {
        const t = text.toLowerCase();
        const rx = new RegExp("(?<![A-Za-z0-9_])" + t.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&"));
        items.push({ main: [`Words meaning “${text}”`], q: /\s/.test(text) ? `en:"${text}"` : `en:${text}` });
        if (!/[\s*]/.test(text)) items.push({ main: [`Words whose meaning starts with “${text}”`], q: `en:${text}*` });
        const lem = [];
        D.lemmaGloss.forEach((g, i) => { if (g && rx.test(g)) lem.push(i); });
        lem.sort((a, b) => D.lemmaCount[b] - D.lemmaCount[a]);
        for (const i of lem.slice(0, 6)) items.push({ main: [arSpan(D.lemmas[i]), ` · ${D.lemmaGloss[i]}`], q: `lemma:=${D.lemmas[i]}` });
        items.push({ main: [`Verses whose translation says “${text}”`], q: `tr:"${text}"` });
      }
    }
    // Every count is what the search will really return; searches that come out the
    // same are listed once.
    const seen = new Set();
    const shown = [];
    for (const it of items) {
      let r;
      try { r = run(it.q); } catch (_) { continue; }
      if (!r.hits.length) continue;
      const sig = `${r.level}:${r.hits.length}:${r.hits[0]}:${r.hits[r.hits.length - 1]}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      it.n = r.hits.length;
      shown.push(it);
    }
    const list = $(`suggest-${k}`);
    list.replaceChildren();
    suggestState = { k, items: shown, sel: -1 };
    if (!shown.length) { list.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    shown.forEach((it, i) => {
      const opt = el("div");
      opt.id = `sug-${k}-${i}`;
      opt.setAttribute("role", "option");
      opt.setAttribute("aria-selected", "false");
      const main = el("span", "s-main"); main.append(...it.main);
      opt.append(main, el("span", "s-n", fmt.format(it.n)), elB("span", "s-q", it.q));
      opt.addEventListener("mousedown", e => { e.preventDefault(); pickSuggest(i); });
      list.append(opt);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function pickSuggest(i) {
    const { k, items } = suggestState;
    if (k < 0 || !items[i] || !series[k]) return;
    series[k].q = items[i].q;
    series[k].label = "";
    $(`q-${k}`).value = items[i].q;
    closeSuggest();
    activeDiscovery = null;
    search();
  }
  function onKey(e, k) {
    if (!series[k]) return;
    const st = suggestState;
    if (st.k === k && st.items.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      st.sel = (st.sel + (e.key === "ArrowDown" ? 1 : -1) + st.items.length) % st.items.length;
      st.items.forEach((_, i) => $(`sug-${k}-${i}`).setAttribute("aria-selected", String(i === st.sel)));
      $(`q-${k}`).setAttribute("aria-activedescendant", `sug-${k}-${st.sel}`);
      $(`sug-${k}-${st.sel}`).scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      buildSuggest(k);
    } else if (e.key === "Enter" && st.k === k && st.sel >= 0) {
      e.preventDefault();
      pickSuggest(st.sel);
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    closeSuggest();
    activeDiscovery = null;
    search();
  });
  $("add-series").addEventListener("click", () => {
    if (series.length >= 3) return;
    series.push({ q: "", label: "" });
    renderRows();
    $(`q-${series.length - 1}`).focus();
  });
  $("help-toggle").addEventListener("click", e => {
    const help = $("help");
    help.hidden = !help.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!help.hidden));
  });

  const EXAMPLES = ["month", "شمس", "root:رحم", "Musa", "tr:\"sacred month\"", "en:star*", "tag:INL", "sajdah:yes", "at:last surah:55"];
  function renderExamples() {
    const ex = $("examples");
    for (const q of EXAMPLES) {
      const b = el("button", "chip-btn");
      b.type = "button";
      b.append(...bidi(q));
      b.addEventListener("click", () => { series = [{ q, label: "" }]; activeDiscovery = null; renderRows(); search(); });
      ex.append(b);
    }
  }

  function interpText(r) {
    return r.error ? r.error : `${capital(describe(r.groups))}: ${plural(r.hits.length, r.level)}`;
  }
  function renderInterp() {
    const ul = $("interp");
    ul.replaceChildren();
    results.forEach((r, k) => {
      const input = $(`q-${k}`);
      if (!r) return;
      const li = el("li");
      li.append(markerSvg(k, 12));
      if (r.error) {
        li.append(elB("span", "err", r.error));
        if (input) input.setAttribute("aria-invalid", "true");
      } else {
        if (input) input.removeAttribute("aria-invalid");
        li.append(elB("span", "", interpText(r)));
      }
      ul.append(li);
    });
  }
  const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

  function search(opts) {
    const before = series.length;
    series = series.filter((s, k) => k === 0 || s.q.trim());
    if (!series.length) series = [{ q: "", label: "" }];
    if (series.length !== before || rowsEl.children.length !== series.length) renderRows();
    results = series.map(s => {
      if (!s.q.trim()) return null;
      const label = s.label || s.q;
      try { return { ...run(s.q), label }; } catch (e) {
        return { error: e instanceof QueryError ? e.message : `Could not run this search: ${e.message}`, hits: [], label };
      }
    });
    if (!activeDiscovery && !(opts && opts.keepHash)) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (_) { /* ignore */ }
    }
    catalogLimit = 25;
    renderAll();
    renderInterp();
    renderStory();
    // One short announcement per search; view changes stay silent.
    $("search-status").textContent = results.filter(Boolean).map(interpText).join(". ");
  }

  // ------------------------------------------------------------------ discoveries
  const CAT_ORDER = ["Numbers & time", "Famous claims", "People & places", "Nature & cosmos", "Structure", "Meccan & Medinan", "Pairs & echoes", "Themes & language"];
  let catFilter = "All";
  let cardsExpanded = false;

  function renderCats() {
    const cats = $("cats");
    const hadFocus = cats.contains(document.activeElement);
    cats.replaceChildren();
    const counts = new Map();
    for (const d of D.discoveries) counts.set(d.category, (counts.get(d.category) || 0) + 1);
    const names = ["All", ...CAT_ORDER.filter(c => counts.has(c)), ...[...counts.keys()].filter(c => !CAT_ORDER.includes(c))];
    for (const c of names) {
      const b = el("button", "cat", c);
      b.type = "button";
      b.setAttribute("aria-pressed", String(c === catFilter));
      const n = c === "All" ? D.discoveries.length : counts.get(c);
      b.append(" ", el("span", "n", String(n)));
      b.setAttribute("aria-label", `${c}, ${plural(n, "discovery", "discoveries")}`);
      b.addEventListener("click", () => { catFilter = c; cardsExpanded = false; renderCats(); renderCards(); });
      cats.append(b);
    }
    if (hadFocus) { const on = cats.querySelector('[aria-pressed="true"]'); if (on) on.focus(); }
    $("discover-count").textContent = String(D.discoveries.length);
  }

  const VERDICT = { holds: ["✓", "holds"], partly: ["≈", "partly"], fails: ["✕", "does not hold"] };
  function verdictPill(v) {
    const p = el("span", "verdict-pill");
    p.append(el("span", "sym", VERDICT[v.result][0]), VERDICT[v.result][1]);
    return p;
  }

  function sortedDiscoveries() {
    const list = D.discoveries.filter(d => catFilter === "All" || d.category === catFilter);
    const catRank = c => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 99 : i; };
    return list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.interest || 0) - (a.interest || 0) || catRank(a.category) - catRank(b.category));
  }

  function renderCards() {
    const cards = $("cards");
    cards.replaceChildren();
    const list = sortedDiscoveries();
    const first = window.matchMedia("(max-width: 640px)").matches ? 4 : 9;
    const limit = cardsExpanded ? list.length : first;
    for (const d of list.slice(0, limit)) {
      const b = el("button", "card");
      b.type = "button";
      b.dataset.id = d.id;
      if (activeDiscovery && activeDiscovery.id === d.id) b.setAttribute("aria-current", "true");
      b.append(el("span", "c-cat", d.category), elB("span", "c-title", d.title));
      const cv = el("canvas");
      cv.setAttribute("aria-hidden", "true");
      b.append(cv);
      const meta = el("span", "c-meta");
      if (d.verdict) meta.append(verdictPill(d.verdict));
      d.series.forEach((s, k) => {
        const m = el("span");
        m.style.display = "inline-flex"; m.style.gap = "4px"; m.style.alignItems = "center";
        m.append(markerSvg(k, 10), ...bidi(`${fmt.format(s.count)} ${s.label.replace(/\s*\(.*\)$/, "")}`));
        meta.append(m);
      });
      b.append(meta);
      b.addEventListener("click", () => { loadDiscovery(d.id, true); });
      cards.append(b);
      queueMini(cv, d);
    }
    const more = $("cards-more");
    more.hidden = list.length <= first;
    more.textContent = cardsExpanded ? "Show fewer" : `Show all ${list.length}`;
    flushMini();
  }
  $("cards-more").addEventListener("click", () => { cardsExpanded = !cardsExpanded; renderCards(); });

  // Small strips on each card, drawn a few at a time so the page stays responsive.
  let miniQueue = [];
  let miniTimer = 0;
  function queueMini(cv, d) { miniQueue.push([cv, d]); }
  function flushMini() {
    clearTimeout(miniTimer);
    const step = () => {
      const batch = miniQueue.splice(0, 4);
      for (const [cv, d] of batch) drawMini(cv, d);
      if (miniQueue.length) miniTimer = setTimeout(step, 16);
    };
    miniTimer = setTimeout(step, 0);
  }
  function drawMini(cv, d) {
    if (!cv.isConnected) return;
    const w = Math.max(100, cv.clientWidth), h = 14, dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#262522";
    c.fillRect(0, 7, w, 1);
    const seq = sequence((d.view && d.view.order) || "mushaf");
    d.series.forEach((s, k) => {
      let r;
      try { r = run(s.q); } catch (_) { return; }
      c.fillStyle = SERIES[k].color;
      c.globalAlpha = r.hits.length > 200 ? 0.35 : 0.9;
      for (const hh of r.hits) {
        const f = hitFraction(r.level, hh, seq);
        const x = (view.dir === "rtl" ? 1 - f : f) * (w - 4) + 2;
        c.fillRect(Math.round(x), 3 + k * 1, 1.5, 8);
      }
    });
    c.globalAlpha = 1;
  }

  // byUser: a click (scroll to the story and move focus there); otherwise the first load,
  // which keeps the viewer's saved shading.
  function loadDiscovery(id, byUser) {
    const d = D.discoveries.find(x => x.id === id);
    if (!d) return false;
    activeDiscovery = d;
    series = d.series.map(s => ({ q: s.q, label: s.label }));
    const v = d.view || {};
    if (ALLOWED.unit.includes(v.unit)) view.unit = v.unit;
    if (ALLOWED.order.includes(v.order)) view.order = v.order;
    if (ALLOWED.shade.includes(v.shade)) view.shade = v.shade;
    else if (byUser) view.shade = "none";
    if (byUser) saveView();
    try { history.replaceState(null, "", "#" + d.id); } catch (_) { /* ignore */ }
    renderRows();
    search({ keepHash: true });
    renderCards();
    if (byUser) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      $("story").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      const h = $("story").querySelector("h2");
      if (h) h.focus({ preventScroll: true });
    }
    return true;
  }
  $("surprise").addEventListener("click", () => {
    const pool = D.discoveries.filter(d => !activeDiscovery || d.id !== activeDiscovery.id);
    if (pool.length) loadDiscovery(pool[Math.floor(Math.random() * pool.length)].id, true);
  });
  const hashId = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (_) { return ""; } };
  window.addEventListener("hashchange", () => {
    if (!D.N) return;
    const id = hashId();
    if (!id) {
      if (activeDiscovery) { activeDiscovery = null; renderCards(); search({ keepHash: true }); }
      return;
    }
    if (!activeDiscovery || activeDiscovery.id !== id) loadDiscovery(id, true);
  });

  function renderStory() {
    const story = $("story");
    story.replaceChildren();
    const main = el("div");
    const actions = el("div", "story-actions");
    if (activeDiscovery) {
      const d = activeDiscovery;
      const h = elB("h2", "", d.title);
      h.tabIndex = -1;
      main.append(el("p", "s-eyebrow", d.category), h, elB("p", "s-blurb", d.blurb));
      if (d.verdict) {
        const v = el("div", "s-verdict");
        const c = el("div", "claim");
        c.append(verdictPill(d.verdict), " ", ...bidi(`The claim: ${d.verdict.claim}`));
        v.append(c, elB("div", "note", d.verdict.note));
        main.append(v);
      }
      const det = el("details");
      det.append(el("summary", "", "How this was counted"));
      if (d.method) det.append(elB("p", "", d.method));
      const ul = el("ul", "s-queries");
      d.series.forEach((s, k) => {
        const li = el("li");
        const code = el("code", "", s.q);
        const right = el("span");
        right.append(code, ...bidi(` · ${s.label} · ${fmt.format(s.count)}`));
        li.append(markerSvg(k, 14), right);
        ul.append(li);
      });
      det.append(ul);
      main.append(det);
      const same = sortedDiscoveries();
      const pos = same.findIndex(x => x.id === d.id);
      const next = el("button", "btn", "Next discovery");
      next.type = "button";
      next.addEventListener("click", () => {
        const pool = pos >= 0 ? same : sortedDiscoveries();
        const nd = pool[(pos + 1) % pool.length];
        if (nd) loadDiscovery(nd.id, true);
      });
      const edit = el("button", "btn", "Change this search");
      edit.type = "button";
      edit.addEventListener("click", () => { $("q-0").focus(); $("q-0").scrollIntoView({ block: "center" }); });
      actions.append(edit, next);
    } else {
      const ok = results.filter(r => r && !r.error);
      main.append(el("p", "s-eyebrow", "Your search"));
      const err = results.find(r => r && r.error);
      if (!ok.length && err) {
        main.append(el("h2", "", "This search has a problem"), elB("p", "s-blurb", err.error));
      } else if (!ok.length) {
        main.append(el("h2", "", "Type something to search"), el("p", "s-blurb", "Search in English or Arabic, or open a discovery above."));
      } else {
        main.append(elB("h2", "", ok.map(r => capital(describe(r.groups))).join(" · ")));
        main.append(elB("p", "s-blurb", results.map((r, k) => r && !r.error ? `${seriesLabel(k)}: ${plural(r.hits.length, r.level)}` : null).filter(Boolean).join(". ") + "."));
      }
    }
    story.append(main, actions);
  }

  // ------------------------------------------------------------------ controls
  const controls = $("controls");
  function syncControls() {
    for (const k of ["unit", "dir", "order"]) {
      const input = controls.querySelector(`#${k}-${view[k]}`);
      if (input) input.checked = true;
    }
    $("shade").value = view.shade;
    $("opt-connect").checked = view.connect;
    const pages = view.unit === "pages";
    if (pages) $("order-mushaf").checked = true;
    $("order-revelation").disabled = pages;
    controls.querySelector("label[for=order-revelation]").title = pages ? "Pages follow the printed mushaf, so they can only be shown in standard order." : "";
  }
  controls.addEventListener("submit", e => e.preventDefault());
  controls.addEventListener("change", e => {
    const t = e.target;
    if (t.name === "unit") view.unit = t.value;
    else if (t.name === "dir") view.dir = t.value;
    else if (t.name === "order") view.order = t.value;
    else if (t.id === "shade") view.shade = t.value;
    else if (t.id === "opt-connect") view.connect = t.checked;
    saveView();
    renderAll();
    if (t.name === "dir") renderCards();
  });

  // ------------------------------------------------------------------ render all
  function renderAll() {
    if (!D.N) return;
    syncControls();
    buildModel();
    hover = null;
    tooltip.hidden = true;
    $("loading").hidden = true;
    resize();
    renderEnds();
    renderLegend();
    renderNotes();
    renderDist();
    renderCatalog();
    document.querySelectorAll(".card").forEach(c => {
      if (activeDiscovery && c.dataset.id === activeDiscovery.id) c.setAttribute("aria-current", "true");
      else c.removeAttribute("aria-current");
    });
  }

  const currentDpr = () => Math.min(window.devicePixelRatio || 1, 3);
  new ResizeObserver(() => {
    if (geo && (Math.floor(box.clientWidth) !== geo.width || currentDpr() !== geo.dpr)) resize();
  }).observe(box);
  (function watchDpr() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => { if (geo && currentDpr() !== geo.dpr) resize(); watchDpr(); };
    if (mq.addEventListener) mq.addEventListener("change", onChange, { once: true });
  })();

  // For checks and for anyone exploring from the console.
  window.quranGrid = {
    run: q => { const r = run(q); return { level: r.level, hits: [...r.hits] }; },
    get view() { return { ...view }; },
    get model() { return model && { unit: model.unit, n: model.n, cols: model.cols, rows: model.rows, dense: model.dense, layers: model.layers.map(l => ({ level: l.level, cells: [...l.cells.keys()] })) }; },
    cellInfo: idx => cellInfo(idx, model.unit, model.seq),
    cellXY: idx => cellXY(idx),
    load: id => loadDiscovery(id, false),
    get discoveries() { return D.discoveries.map(d => d.id); },
  };

  // ------------------------------------------------------------------ boot
  renderExamples();
  series = [{ q: "", label: "" }];
  renderRows();
  unpack().then(raw => {
    buildIndex(raw);
    renderCats();
    renderCards();
    const id = hashId();
    if (!(id && loadDiscovery(id, false))) {
      if (!loadDiscovery("month", false)) { series = [{ q: "root:شهر", label: "Month (ش ه ر)" }]; renderRows(); search(); }
    }
    document.dispatchEvent(new CustomEvent("quran-grid-ready"));
  }).catch(err => {
    $("loading").textContent = err.message;
    console.error(err);
  });
})();
