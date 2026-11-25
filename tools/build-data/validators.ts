export type Issue = {
  file: string;
  n?: number;
  rule: string;
  message: string;
  severity?: "error" | "warn";
};

type Row = Record<string, any>;

export const BRANDS = [
  "thermos", "frisbee", "jet ski", "skittles", "velcro", "scotch", "hoover",
  "stanley", "rubik's", "rubiks", "crescent wrench", "stillson", "skill saw",
  "jubilee", "zeppelin", "popsicle",
];
const BRAND_RE = new RegExp(`(^|[^a-z])(${BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})($|[^a-z])`, "i");

const ALLOWED_PLACEHOLDERS = new Set(["answer", "n", "total", "score", "region", "category", "part"]);
const lc = (s: unknown) => String(s).toLowerCase().trim();
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap(strings) : typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

function brandIssues(file: string, rows: Row[]): Issue[] {
  const out: Issue[] = [];
  for (const r of rows) {
    const hit = strings(r).find((s) => BRAND_RE.test(s));
    if (hit) out.push({ file, n: r.n, rule: "brand", message: `brand name in "${hit}"` });
  }
  return out;
}

export function validateCountries(rows: Row[]): Issue[] {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const codes = new Set(rows.map((r) => r.iso2));
  for (const r of rows) {
    if (seen.has(r.iso2)) out.push({ file: "countries", n: r.n, rule: "duplicate-iso2", message: r.iso2 });
    seen.add(r.iso2);
    for (const f of ["iso2", "name", "altNames", "continent", "subregion", "capital", "flagDifficulty", "flagLookalikes", "flagHint"]) {
      if (r[f] === undefined) out.push({ file: "countries", n: r.n, rule: "missing-field", message: f });
    }
    if (![1, 2, 3, 4, 5].includes(r.flagDifficulty)) out.push({ file: "countries", n: r.n, rule: "flag-difficulty", message: String(r.flagDifficulty) });
    for (const l of r.flagLookalikes ?? []) if (!codes.has(l)) out.push({ file: "countries", n: r.n, rule: "unknown-lookalike", message: l });
  }
  return out;
}

const TABLE: Record<string, number> = {
  animals: 250, "food-and-fruit": 150, "everyday-objects": 150, "tools-and-hardware": 80,
  "vehicle-types": 80, "plants-and-flowers": 80, "instruments-and-sports-equipment": 100,
  "space-and-science-objects": 70, "human-body-light": 40,
};
const FORMATS = new Set(["zoom", "silhouette", "blur", "half", "pixel"]);

export function validateWhatIsIt(rows: Row[]): Issue[] {
  const out: Issue[] = brandIssues("what_is_it", rows);
  const answers = new Map<string, number>();
  const altOwners = new Map<string, number[]>();
  for (const r of rows) {
    answers.set(lc(r.answer), (answers.get(lc(r.answer)) ?? 0) + 1);
    for (const a of r.altAnswers ?? []) altOwners.set(lc(a), [...(altOwners.get(lc(a)) ?? []), r.n]);
  }
  for (const r of rows) {
    if ((answers.get(lc(r.answer)) ?? 0) > 1) out.push({ file: "what_is_it", n: r.n, rule: "duplicate-answer", message: r.answer });
    const words = String(r.answer).trim().split(/\s+/).length;
    if (words < 1 || words > 3) out.push({ file: "what_is_it", n: r.n, rule: "answer-words", message: r.answer });
    if ((r.altAnswers ?? []).length > 3) out.push({ file: "what_is_it", n: r.n, rule: "alt-count", message: r.answer });
    if (!(r.bestFormats ?? []).length || r.bestFormats.length > 3 || r.bestFormats.some((f: string) => !FORMATS.has(f))) out.push({ file: "what_is_it", n: r.n, rule: "formats", message: JSON.stringify(r.bestFormats) });
    if (!(r.imageSearch ?? []).length || r.imageSearch.length > 3) out.push({ file: "what_is_it", n: r.n, rule: "image-search", message: r.answer });
    const bad = new Set([lc(r.answer), ...(r.altAnswers ?? []).map(lc)]);
    const w: string[] = r.wrongOptions ?? [];
    if (w.length !== 3 || new Set(w.map(lc)).size !== 3) out.push({ file: "what_is_it", n: r.n, rule: "wrong-options-count", message: r.answer });
    if (w.some((o) => bad.has(lc(o)))) out.push({ file: "what_is_it", n: r.n, rule: "wrong-option-is-answer", message: `${r.answer}: ${w.join(", ")}` });
  }
  for (const [alt, owners] of altOwners) {
    if (answers.has(alt) || owners.length > 1) out.push({ file: "what_is_it", n: owners[0], rule: "alt-clash", message: `"${alt}" used by ${owners.join(",")}` });
  }
  const ns = rows.map((r) => r.n);
  if (ns.some((n, i) => n !== i + 1)) out.push({ file: "what_is_it", rule: "numbering", message: "n is not 1..N contiguous" });
  const cats: Record<string, number> = {};
  for (const r of rows) cats[r.category] = (cats[r.category] ?? 0) + 1;
  for (const [c, k] of Object.entries(TABLE)) if (cats[c] !== k) out.push({ file: "what_is_it", rule: "category-count", message: `${c}: ${cats[c] ?? 0}/${k}` });
  return out;
}

export function validateLandmarks(rows: Row[], countries: Row[]): Issue[] {
  const out: Issue[] = brandIssues("landmarks", rows);
  const iso = new Map(countries.map((c) => [c.iso2, c.name]));
  for (const r of rows) {
    if (!iso.has(r.iso2)) out.push({ file: "landmarks", n: r.n, rule: "unknown-country", message: `${r.iso2} ${r.country}` });
    else if (iso.get(r.iso2) !== r.country) out.push({ file: "landmarks", n: r.n, rule: "country-name", message: `${r.country} vs ${iso.get(r.iso2)}` });
    const d: string[] = r.distractorIso2 ?? [];
    if (d.length !== 3 || new Set(d).size !== 3 || d.includes(r.iso2) || d.some((c) => !iso.has(c))) out.push({ file: "landmarks", n: r.n, rule: "distractors", message: d.join(",") });
  }
  return out;
}

export function validateMissingLetters(rows: Row[]): Issue[] {
  const out: Issue[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const w = String(r.word).replace(/ /g, "");
    const push = (rule: string, message: string) => out.push({ file: "missing_letters", n: r.n, rule, message, severity: "warn" });
    seen.set(lc(r.word), (seen.get(lc(r.word)) ?? 0) + 1);
    if (!/^[A-Za-z ]+$/.test(r.word) || String(r.word).split(" ").length > 2) push("word-chars", r.word);
    if (w.length < 5 || w.length > 11) push("word-length", `${r.word} (${w.length})`);
    if (String(r.hint).split(/\s+/).length > 8) push("hint-length", r.hint);
    const word = w.toLowerCase();
    for (const t of String(r.hint).toLowerCase().match(/[a-z]+/g) ?? []) if (t.length >= 4 && (word.includes(t) || t.includes(word))) push("hint-leak", `${r.word}: ${t}`);
  }
  for (const [w, k] of seen) if (k > 1) out.push({ file: "missing_letters", rule: "duplicate-word", message: w, severity: "warn" });
  return out;
}

const VOICE_COUNTS: Record<string, number> = { intro: 10, ask: 8, countdown: 6, revealCorrect: 10, transition: 8, difficultyUp: 5, outro: 10, likeCta: 6, subscribeCta: 6, lastCta: 6 };

export function validateVoiceLines(formats: Row[]): Issue[] {
  const out: Issue[] = [];
  for (const f of formats) {
    for (const [type, count] of Object.entries(VOICE_COUNTS)) {
      const lines: string[] = f[type] ?? [];
      if (lines.length !== count) out.push({ file: "voice_lines", rule: "line-count", message: `${f.format}.${type}: ${lines.length}/${count}` });
      for (const line of lines) {
        for (const m of line.matchAll(/\{(\w+)\}/g)) if (!ALLOWED_PLACEHOLDERS.has(m[1])) out.push({ file: "voice_lines", rule: "placeholder", message: `${f.format}.${type}: ${line}` });
        if (type === "revealCorrect" && (line.match(/\{answer\}/g) ?? []).length !== 1) out.push({ file: "voice_lines", rule: "answer-count", message: `${f.format}: ${line}` });
      }
    }
  }
  return out;
}

const TITLE_COUNTS: Record<string, number> = { titles: 30, titlesSeries: 8, descriptions: 12, pinnedComments: 10, hashtagSets: 10 };

export function validateTitles(formats: Row[]): Issue[] {
  const out: Issue[] = [];
  for (const f of formats) {
    for (const [k, c] of Object.entries(TITLE_COUNTS)) if ((f[k] ?? []).length !== c) out.push({ file: "titles", rule: "count", message: `${f.format}.${k}: ${(f[k] ?? []).length}/${c}` });
    for (const t of [...(f.titles ?? []), ...(f.titlesSeries ?? [])]) if ([...t].length > 70) out.push({ file: "titles", rule: "title-length", message: t });
    for (const p of f.pinnedComments ?? []) if ([...p].length > 120) out.push({ file: "titles", rule: "pinned-length", message: p });
    for (const s of f.hashtagSets ?? []) if (!s.includes("#shorts") || s.length < 3 || s.length > 5) out.push({ file: "titles", rule: "hashtags", message: s.join(" ") });
  }
  return out;
}

export const BACKGROUND_TYPES = ["pattern", "animated-gradient", "texture", "bokeh", "gradient", "grid", "sunburst", "spotlight", "checker", "dots", "shapes"];
export const TIMER_STYLES = ["bar", "ring", "pulse", "hourglass", "numeric", "flip", "pie", "dial", "big-number"];
export const REVEAL_STYLES = ["wipe", "pop", "confetti", "shake", "flip", "slide"];
const PALETTE_KEYS = ["bgFrom", "bgTo", "card", "text", "accent", "accent2", "correct", "wrong"];

export function validateThemes(rows: Row[]): Issue[] {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const t of rows) {
    const push = (rule: string, message: string) => out.push({ file: "themes", rule, message: `${t.id}: ${message}` });
    if (seen.has(t.id)) push("duplicate-id", t.id);
    seen.add(t.id);
    for (const k of PALETTE_KEYS) if (!t.palette?.[k]) push("palette", `missing ${k}`);
    if (!BACKGROUND_TYPES.includes(t.background?.type)) push("background-type", String(t.background?.type));
    if (!TIMER_STYLES.includes(t.timer?.style)) push("timer-style", String(t.timer?.style));
    if (!REVEAL_STYLES.includes(t.reveal?.style)) push("reveal-style", String(t.reveal?.style));
    for (const r of ["title", "body", "numbers"]) if (!t.fonts?.[r]) push("fonts", `missing ${r}`);
    if (!/\d+\s*bpm/i.test(t.music?.mood ?? "")) push("music-bpm", String(t.music?.mood));
    if (t.titleStyle && (typeof t.titleStyle.stroke !== "string" || !(t.titleStyle.strokeWidth > 0 && t.titleStyle.strokeWidth <= 14))) push("title-style", JSON.stringify(t.titleStyle));
  }
  return out;
}
