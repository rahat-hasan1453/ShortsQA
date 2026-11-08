import { createRng } from "./rng";
import { buildTimeline, DurationError } from "./timeline";
import { lineDurationMs, slotValues, type Slots } from "./lines";
import type { Band, Country, QuizQuestion, QuizSpec, Theme, VoiceLines } from "./types";

export const bandOf = (d: number): Band => (d <= 2 ? "easy" : d === 3 ? "medium" : d === 4 ? "hard" : "impossible");
const BAND_COUNTS: [Band, number][] = [["easy", 3], ["medium", 3], ["hard", 3], ["impossible", 1]];
const DIFF_UP_BEFORE = [3, 6, 9];

export interface BuildInput {
  seed: string;
  themeId?: string;
  part?: number;
  useRegionTwist?: boolean;
  regionOverride?: string;
  countries: Country[];
  themes: Theme[];
  voice: VoiceLines;
  clipMs: (text: string) => number;
}

const hasEnough = (pool: Country[]) =>
  BAND_COUNTS.every(([b, n]) => pool.filter((c) => bandOf(c.flagDifficulty) === b).length >= n);

/** Target total duration; leaves 1.5 s of headroom below the 59 s hard limit. */
const TARGET_SEC = 57.5;
const SCALES = [1, 0.75, 0.5, 0];

export function buildQuiz(input: BuildInput): QuizSpec {
  let last!: QuizSpec;
  for (const scale of SCALES) {
    last = buildAttempt(input, scale);
    try {
      if (buildTimeline(last, { clipMs: input.clipMs, voice: input.voice }).duration <= TARGET_SEC) return last;
    } catch (e) {
      if (!(e instanceof DurationError)) throw e;
    }
  }
  return last;
}

function buildAttempt(input: BuildInput, scale: number): QuizSpec {
  const { seed, countries, themes, voice, clipMs } = input;
  const rng = createRng(seed);
  const part = Math.min(99, Math.max(1, Math.trunc(input.part ?? 1) || 1));

  const flagThemes = themes.filter((t) => t.bestFor.includes("flags"));
  const theme = themes.find((t) => t.id === input.themeId) ?? rng.pick(flagThemes.length ? flagThemes : themes);

  let twistRegion: string | undefined;
  if (input.useRegionTwist) {
    const regions = input.regionOverride ? [input.regionOverride] : rng.shuffle([...new Set(countries.map((c) => c.continent))]);
    twistRegion = regions.find((r) => hasEnough(countries.filter((c) => c.continent === r)));
  }
  const pool = twistRegion ? countries.filter((c) => c.continent === twistRegion) : countries;

  const picked: { c: Country; band: Band }[] = [];
  for (const [band, n] of BAND_COUNTS) {
    const candidates = rng.shuffle(pool.filter((c) => bandOf(c.flagDifficulty) === band));
    for (const c of candidates.slice(0, n)) picked.push({ c, band });
  }

  const ok = (line: string) => !line.includes("{score}") && !line.includes("{category}") && (twistRegion || !line.includes("{region}"));
  const eligible = (type: keyof VoiceLines, extra?: (l: string) => boolean) =>
    (voice[type] as string[]).map((line, i) => ({ line, id: `${voice.format}.${type}.${i}` })).filter((x) => ok(x.line) && (!extra || extra(x.line)));
  const fit = (type: keyof VoiceLines, slots: Slots, maxMs: number, extra?: (l: string) => boolean): string => {
    const all = eligible(type, extra).map((x) => ({ ...x, ms: lineDurationMs(x.line, slots, clipMs) }));
    const fits = all.filter((x) => x.ms <= maxMs * scale);
    if (fits.length) return rng.pick(fits).id;
    return all.reduce((a, b) => (b.ms < a.ms ? b : a)).id;
  };

  const draft: QuizSpec = {
    version: 1, format: "flags-rapid", seed, themeId: theme.id, part, twistRegion,
    hookLineId: "", difficultyUpLineIds: {}, outroLineId: "", questions: [],
  };
  const gen = slotValues(draft);
  draft.hookLineId = fit("intro", gen, 2500);
  draft.outroLineId = fit("outro", gen, 3500);
  for (const i of DIFF_UP_BEFORE) draft.difficultyUpLineIds[i] = fit("difficultyUp", gen, 1300);

  draft.questions = picked.map(({ c, band }, index): QuizQuestion => {
    const q: QuizQuestion = { index, iso2: c.iso2, name: c.name, band, revealLineId: "" };
    const slots = slotValues(draft, q);
    q.revealLineId = fit("revealCorrect", slots, 1400, (l) => (l.match(/\{answer\}/g) ?? []).length === 1);
    if (!DIFF_UP_BEFORE.includes(index)) {
      const roll = index === 0 ? 0 : rng.next();
      if (roll < 0.4) q.askLineId = fit("ask", slots, 1600);
      else if (roll < 0.65) q.transitionLineId = fit("transition", slots, 1200);
    }
    if (rng.next() < 0.3) q.countdownLineId = fit("countdown", slots, 1200);
    return q;
  });
  return draft;
}
