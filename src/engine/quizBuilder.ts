import { createRng } from "./rng";
import { buildTimeline, DurationError } from "./timeline";
import { lineDurationMs, numberWords, slotValues, type Slots } from "./lines";
import type { AnswerStyle, Band, Profile, QuizKind, Country, QuizQuestion, QuizSpec, Theme, VoiceLines, WordItem, LandmarkItem, PictureItem } from "./types";

export const bandOf = (d: number): Band => (d <= 2 ? "easy" : d === 3 ? "medium" : d === 4 ? "hard" : "impossible");
type Counts = [Band, number][];
/** Questions per difficulty band: 10 for Shorts, 30 for long videos (owner's choice). */
export const bandCounts = (profile: Profile = "short"): Counts =>
  profile === "long" ? [["easy", 10], ["medium", 8], ["hard", 7], ["impossible", 5]] : [["easy", 3], ["medium", 3], ["hard", 3], ["impossible", 1]];
/** Fewest questions a quiz may have: Shorts always have 10; a long video takes what its pool allows, down to 24. */
const minCount = (profile: Profile = "short") => (profile === "long" ? 24 : 10);

export interface BuildInput {
  seed: string;
  themeId?: string;
  part?: number;
  noPart?: boolean;
  useRegionTwist?: boolean;
  regionOverride?: string;
  answerStyle?: AnswerStyle;
  quiz?: QuizKind;
  /** "long" builds about 30 questions (A-D options) for a 16:9 video; default "short". */
  profile?: Profile;
  /** Word list for the missing-letters quiz. */
  words?: WordItem[];
  /** Landmark list for the landmarks quiz (only ones with a photo). */
  landmarks?: LandmarkItem[];
  /** Picture list for the what-is-it quiz (only ones with a photo). */
  pictures?: PictureItem[];
  /** Country-shape quiz: countries that have an outline (public/shapes.json). */
  shapeIso2?: Set<string>;
  countries: Country[];
  themes: Theme[];
  voice: VoiceLines;
  clipMs: (text: string) => number;
}

/** Three wrong names: look-alike flags first, then the same continent, then anything. */
function makeOptions(seed: string, c: Country, countries: Country[], label: (c: Country) => string = (x) => x.name, shape = false): { names: string[]; correct: number } {
  const rng = createRng(`${seed}|options|${c.iso2}`);
  const byIso = new Map(countries.map((x) => [x.iso2, x]));
  const look = shape // outlines: neighbours in the same sub-region make the best wrong answers
    ? rng.shuffle(countries.filter((x) => x.subregion === c.subregion && x.iso2 !== c.iso2))
    : rng.shuffle(c.flagLookalikes.map((i) => byIso.get(i)).filter((x): x is Country => !!x && x.iso2 !== c.iso2));
  const same = rng.shuffle(countries.filter((x) => x.continent === c.continent && x.iso2 !== c.iso2));
  const any = rng.shuffle(countries.filter((x) => x.iso2 !== c.iso2));
  const wrong: string[] = [];
  for (const x of [...look, ...same, ...any]) {
    if (wrong.length === 3) break;
    if (!wrong.includes(label(x)) && label(x) !== label(c)) wrong.push(label(x));
  }
  const names = rng.shuffle([label(c), ...wrong]);
  return { names, correct: names.indexOf(label(c)) };
}

type Picked = { band: Band; base: Pick<QuizQuestion, "iso2" | "shape" | "image" | "effect" | "focus" | "name" | "prompt" | "spoken" | "cardText" | "cardReveal" | "fakeHue">; options: () => { names: string[]; correct: number } };

function optionsFrom(seed: string, answer: string, wrongCandidates: string[]): { names: string[]; correct: number } {
  const rng = createRng(`${seed}|options|${answer}`);
  const wrong = [...new Set(wrongCandidates)].filter((w) => w !== answer).slice(0, 3);
  const names = rng.shuffle([answer, ...wrong]);
  return { names, correct: names.indexOf(answer) };
}

/** Ten sums, harder per band. Every answer is 0-99 so it has a spoken-number clip. */
function pickMath(seed: string, counts: Counts): Picked[] {
  const rng = createRng(`${seed}|math`);
  const int = (a: number, b: number) => a + Math.floor(rng.next() * (b - a + 1));
  const gen: Record<Band, () => [string, number]> = {
    easy: () => { const a = int(2, 9), b = int(2, 9); return rng.next() < 0.5 ? [`${a} + ${b}`, a + b] : [`${a + b} - ${b}`, a]; },
    medium: () => {
      if (rng.next() < 0.5) { const a = int(3, 9), b = int(3, 9); return [`${a} × ${b}`, a * b]; }
      const a = int(12, 49), b = int(12, 49); return [`${a} + ${b}`, a + b];
    },
    hard: () => {
      if (rng.next() < 0.5) { const b = int(3, 9), r = int(6, 12); return [`${b * r} ÷ ${b}`, r]; }
      const a = int(11, 16), b = int(3, 6); return [`${a} × ${b}`, a * b];
    },
    impossible: () => { const a = int(6, 9), b = int(6, 9), c = int(11, 18); return [`${a} × ${b} + ${c}`, a * b + c]; },
  };
  const seen = new Set<string>(), out: Picked[] = [];
  for (const [band, n] of counts) {
    for (let i = 0; i < n; i++) {
      let expr: string, ans: number;
      do { [expr, ans] = gen[band](); } while (seen.has(expr));
      seen.add(expr);
      const near = createRng(`${seed}|near|${expr}`).shuffle([1, -1, 2, -2, 10, -10, 3, -3]).map((d) => ans + d).filter((v) => v >= 0 && v <= 99).map(String);
      out.push({ band, base: { name: String(ans), spoken: numberWords(ans), cardText: `${expr} = ?`, cardReveal: `${expr} = ${ans}` }, options: () => optionsFrom(seed, String(ans), near) });
    }
  }
  return out;
}

const HIDE_RATIO: Record<Band, number> = { easy: 0.3, medium: 0.4, hard: 0.5, impossible: 0.6 };

/** Ten single words (4-9 letters) with letters blanked; more blanks per band. The longest hard word is the "impossible" one. */
function pickWords(seed: string, words: WordItem[], counts: Counts, min: number): Picked[] {
  const rng = createRng(`${seed}|words`);
  const ok = rng.shuffle(words.filter((w) => /^[A-Za-z]{4,9}$/.test(w.word)));
  const hard = ok.filter((w) => w.difficulty >= 3);
  const last = hard.reduce((a, b) => (b.word.length > a.word.length ? b : a), hard[0]);
  const pools: Record<Band, WordItem[]> = {
    easy: ok.filter((w) => w.difficulty <= 1), medium: ok.filter((w) => w.difficulty === 2),
    hard: hard.filter((w) => w !== last), impossible: last ? [last] : [],
  };
  const out: Picked[] = [];
  for (const [band, n] of counts) {
    for (const w of pools[band].slice(0, n)) {
      const letters = w.word.toUpperCase().split("");
      const count = Math.min(letters.length - 2, Math.max(1, Math.round(letters.length * HIDE_RATIO[band])));
      const hidden = new Set(createRng(`${seed}|mask|${w.word}`).shuffle(letters.map((_, i) => i)).slice(0, count));
      const others = ok.filter((x) => x !== w);
      const sameLen = others.filter((x) => x.word.length === w.word.length); // same length first, so the blanks alone do not give it away
      const wrong = [...sameLen.filter((x) => x.category === w.category), ...sameLen, ...others.filter((x) => x.category === w.category), ...others].map((x) => x.word);
      out.push({
        band,
        base: { name: w.word, cardText: letters.map((ch, i) => (hidden.has(i) ? "_" : ch)).join(" "), cardReveal: letters.join(" ") },
        options: () => optionsFrom(seed, w.word, wrong),
      });
    }
  }
  if (out.length < min) throw new Error(`not enough words for a missing-letters quiz (${out.length} of ${min})`);
  return out;
}

/** Ten landmark photos (answer: the country), at most one per country. */
function pickLandmarks(seed: string, landmarks: LandmarkItem[], countries: Country[], counts: Counts, min: number): Picked[] {
  const rng = createRng(`${seed}|landmarks`);
  const byIso = new Map(countries.map((c) => [c.iso2, c]));
  const usedCountries = new Set<string>(), out: Picked[] = [];
  for (const [band, n] of counts) {
    const pool = rng.shuffle(landmarks.filter((l) => bandOf(l.difficulty) === band && byIso.has(l.iso2)));
    let taken = 0;
    for (const l of pool) {
      if (taken === n) break;
      if (usedCountries.has(l.iso2)) continue;
      usedCountries.add(l.iso2); taken++;
      const answer = byIso.get(l.iso2)!;
      const wrong = [
        ...l.distractorIso2.map((i) => byIso.get(i)),
        ...rng.shuffle(countries.filter((c) => c.continent === answer.continent)),
        ...rng.shuffle(countries),
      ].filter((c): c is Country => !!c).map((c) => c.name);
      out.push({ band, base: { image: l.id, name: answer.name, prompt: l.name }, options: () => optionsFrom(seed, answer.name, wrong) });
    }
  }
  if (out.length < min) throw new Error(`not enough landmark photos for a landmarks quiz (${out.length} of ${min})`);
  return out;
}

/** Ten mystery pictures: difficulty 1 x3, 2 x3, 3 x3 and one more difficulty-3 as the "impossible" one; different categories first. */
function pickPictures(seed: string, items: PictureItem[], counts: Counts, min: number): Picked[] {
  const rng = createRng(`${seed}|pictures`);
  const used = new Set<string>(), usedCat = new Map<string, number>(), out: Picked[] = [];
  const level: Record<Band, number> = { easy: 1, medium: 2, hard: 3, impossible: 3 };
  for (const [band, n] of counts) {
    const pool = rng.shuffle(items.filter((x) => x.difficulty === level[band] && !used.has(x.id)));
    pool.sort((a, b) => (usedCat.get(a.category) ?? 0) - (usedCat.get(b.category) ?? 0)); // stable: least-used categories first
    for (const it of pool.slice(0, n)) {
      used.add(it.id); usedCat.set(it.category, (usedCat.get(it.category) ?? 0) + 1);
      const fx = createRng(`${seed}|focus|${it.id}`);
      const effect = it.effects.length ? fx.pick(it.effects) : "zoom";
      out.push({
        band,
        base: { image: it.id, name: it.name, effect, focus: [0.3 + fx.next() * 0.4, 0.3 + fx.next() * 0.4] },
        options: () => optionsFrom(seed, it.name, rng.shuffle(it.wrong)),
      });
    }
  }
  if (out.length < min) throw new Error(`not enough pictures for a what-is-it quiz (${out.length} of ${min})`);
  return out;
}

const hasEnough = (pool: Country[], diff: (c: Country) => number = (c) => c.flagDifficulty, counts: Counts = bandCounts()) =>
  counts.every(([b, n]) => pool.filter((c) => bandOf(diff(c)) === b).length >= n);

/** Target total duration; Shorts leave 0.6 s of headroom below the 59 s hard limit, long videos stay near 8 minutes. */
const TARGET_SEC = { short: 58.4, long: 480 } as const;
/** [line-length scale, number of fun facts], tried in order until the video fits. */
const ATTEMPTS: Record<Profile, [number, number, boolean?, number?][]> = {
  short: [[1, 2], [1, 1], [0.75, 1], [0.5, 1], [1, 1, false, 3500], [0.5, 1, false, 3500], [1, 0], [0.75, 0], [0.5, 0], [0, 0], [0, 0, true]],
  long: [[1, 14], [1, 10], [0.75, 10], [0.75, 6], [0.5, 4], [0.5, 0], [0, 0]],
};

export function buildQuiz(input: BuildInput): QuizSpec {
  const profile = input.profile ?? "short";
  let last!: QuizSpec;
  for (const [scale, nFacts, noLike, maxFactMs] of ATTEMPTS[profile]) {
    last = buildAttempt(input, scale, nFacts, noLike, maxFactMs);
    try {
      if (buildTimeline(last, { clipMs: input.clipMs, voice: input.voice }).duration <= TARGET_SEC[profile]) return last;
    } catch (e) {
      if (!(e instanceof DurationError)) throw e;
    }
  }
  return last;
}

function buildAttempt(input: BuildInput, scale: number, nFacts = 0, noLike = false, maxFactMs = 4800): QuizSpec {
  const { seed, themes, voice, clipMs } = input;
  const capitals = input.quiz === "capitals";
  const shape = input.quiz === "country-shape";
  const diff = (c: Country) => (shape ? c.shapeDifficulty ?? c.flagDifficulty : c.flagDifficulty);
  const countries = capitals ? input.countries.filter((c) => c.capital) : shape ? input.countries.filter((c) => input.shapeIso2?.has(c.iso2)) : input.countries;
  const answerOf = (c: Country) => (capitals ? c.capital : c.name);
  const rng = createRng(seed);
  const part = Math.min(99, Math.max(1, Math.trunc(input.part ?? 1) || 1));
  const profile = input.profile ?? "short", counts = bandCounts(profile), min = minCount(profile);

  const flagThemes = themes.filter((t) => t.bestFor.includes("flags"));
  const featured = flagThemes.filter((t) => t.featured);
  const theme = themes.find((t) => t.id === input.themeId) ?? rng.pick(featured.length ? featured : flagThemes.length ? flagThemes : themes);

  let twistRegion: string | undefined;
  if (input.useRegionTwist) {
    const regions = input.regionOverride ? [input.regionOverride] : rng.shuffle([...new Set(countries.map((c) => c.continent))]);
    twistRegion = regions.find((r) => hasEnough(countries.filter((c) => c.continent === r), diff, counts));
  }
  const pool = twistRegion ? countries.filter((c) => c.continent === twistRegion) : countries;

  let picked: Picked[] = [];
  if (input.quiz === "math") picked = pickMath(seed, counts);
  else if (input.quiz === "missing-letters") picked = pickWords(seed, input.words ?? [], counts, min);
  else if (input.quiz === "what-is-it") picked = pickPictures(seed, input.pictures ?? [], counts, min);
  else if (input.quiz === "landmarks") picked = pickLandmarks(seed, input.landmarks ?? [], input.countries, counts, min);
  else {
    const realFake = input.quiz === "real-vs-fake-flag";
    const total = counts.reduce((a, [, n]) => a + n, 0);
    const fakes = createRng(`${seed}|fake`).shuffle(Array.from({ length: total }, (_, i) => i < total / 2)); // half real, half fake
    const hues = createRng(`${seed}|hue`);
    for (const [band, n] of counts) {
      const candidates = rng.shuffle(pool.filter((c) => bandOf(diff(c)) === band));
      for (const c of candidates.slice(0, n)) {
        if (realFake) {
          const fake = fakes[picked.length];
          picked.push({
            band,
            base: { iso2: c.iso2, name: fake ? "Fake" : "Real", spoken: fake ? "fake" : "real", prompt: c.name, ...(fake ? { fakeHue: hues.pick([90, 150, 210, 270]) } : {}) },
            options: () => ({ names: ["Real", "Fake"], correct: fake ? 1 : 0 }),
          });
          continue;
        }
        picked.push({ band, base: { iso2: c.iso2, name: answerOf(c), ...(capitals ? { prompt: c.name } : {}), ...(shape ? { shape: true } : {}) }, options: () => makeOptions(seed, c, countries, answerOf, shape) });
      }
    }
    if (picked.length < min) throw new Error(`not enough countries for this quiz (${picked.length} of ${min})`);
  }
  // A level-up line before the first question of each new band ([3, 6, 9] for Shorts).
  const diffUpBefore = picked.map((p, i) => (i > 0 && p.band !== picked[i - 1].band ? i : -1)).filter((i) => i > 0);

  const ok = (line: string) => !(input.noPart && line.includes("{part}")) && !line.includes("{score}") && !line.includes("{category}") && (twistRegion || !line.includes("{region}"));
  const eligible = (type: keyof VoiceLines, extra?: (l: string) => boolean) =>
    (voice[type] as string[]).map((line, i) => ({ line, id: `${voice.format}.${type}.${i}` })).filter((x) => ok(x.line) && (!extra || extra(x.line)));
  const fit = (type: keyof VoiceLines, slots: Slots, maxMs: number, extra?: (l: string) => boolean): string => {
    const all = eligible(type, extra).map((x) => ({ ...x, ms: lineDurationMs(x.line, slots, clipMs) }));
    const fits = all.filter((x) => x.ms <= maxMs * scale);
    if (fits.length) return rng.pick(fits).id;
    return all.reduce((a, b) => (b.ms < a.ms ? b : a)).id;
  };

  // Lines glued from several clips ("ten" + "flags, no help") change pitch at the joins and sound robotic; Shorts prefer lines that are one clip.
  const noSlots = (l: string) => !/\{(total|n|part)\}/.test(l);
  const shortOnly = profile === "short" ? noSlots : undefined;
  const draft: QuizSpec = {
    version: 1, format: "flags-rapid", seed, themeId: theme.id, part, twistRegion, ...(input.noPart ? { noPart: true } : {}), answerStyle: profile === "long" ? "options" : input.answerStyle ?? "open", ...(profile === "long" ? { profile } : {}), ...(input.quiz && input.quiz !== "flags" ? { quiz: input.quiz } : {}),
    ...(noLike ? { noLikeVoice: true } : {}), hookLineId: "", difficultyUpLineIds: {}, outroLineId: "", questions: [],
  };
  const gen = { ...slotValues(draft), total: numberWords(picked.length) };
  draft.hookLineId = fit("intro", gen, 3000, shortOnly);
  draft.outroLineId = fit("outro", gen, 3500, shortOnly);
  for (const i of diffUpBefore) draft.difficultyUpLineIds[i] = fit("difficultyUp", gen, 1300);
  if (profile === "short" && !noLike) { // the like / subscribe / last-question calls to action (spoken with the banners before questions 4, 7 and 10)
    const cta: NonNullable<QuizSpec["ctaLineIds"]> = {};
    if (eligible("likeCta").length) cta.like = fit("likeCta", gen, 1900);
    if (eligible("subscribeCta").length) cta.subscribe = fit("subscribeCta", gen, 2200);
    if (eligible("lastCta").length) cta.last = fit("lastCta", gen, 3000);
    if (Object.keys(cta).length) draft.ctaLineIds = cta;
  }

  draft.questions = picked.map(({ base, band, options }, index): QuizQuestion => {
    const q: QuizQuestion = { index, ...base, band, revealLineId: "" };
    if (draft.answerStyle === "options") q.options = options();
    const slots = slotValues(draft, q);
    q.revealLineId = fit("revealCorrect", slots, 1400, (l) => (l.match(/\{answer\}/g) ?? []).length === 1 && !/\byes\b/i.test(l));
    if (scale > 0 && profile === "short") { // scale 0 = bare-bones attempt without optional lines
      // Shorts: the task is said once (question 1), then only the answers are spoken. Counting every question ("Flag two") sounded robotic.
      if (index === 0) q.askLineId = fit("ask", slots, 1600, noSlots);
    } else if (scale > 0 && !diffUpBefore.includes(index)) {
      const roll = index === 0 ? 0 : rng.next();
      if (roll < 0.4) q.askLineId = fit("ask", slots, 1600);
      else if (roll < 0.65) q.transitionLineId = fit("transition", slots, 1200);
    }
    if (scale > 0 && rng.next() < 0.15) q.countdownLineId = fit("countdown", slots, 1200);
    return q;
  });
  // Fun facts (about the answer's country) on a couple of questions, as long as the clip is short enough.
  if (nFacts > 0 && ["flags", "capitals", "country-shape", "landmarks", undefined].includes(input.quiz)) {
    const byKey = new Map(input.countries.flatMap((c) => [[c.iso2, c], [c.name, c]] as const));
    const order = createRng(`${seed}|facts`).shuffle(draft.questions.map((_, i) => i).filter((i) => i > 0));
    let given = 0;
    for (const i of order) {
      const q = draft.questions[i];
      const fact = byKey.get(input.quiz === "landmarks" ? q.name : q.iso2 ?? "")?.funFact;
      if (!fact || clipMs(fact) > maxFactMs || given === nFacts) continue;
      q.fact = fact; given++;
    }
  }
  return draft;
}
