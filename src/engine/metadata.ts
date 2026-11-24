import { createRng } from "./rng";
import type { QuizSpec, Timeline } from "./types";

export interface TitleBank {
  format: string;
  titles: string[];
  titlesSeries: string[];
  descriptions: string[];
  pinnedComments: string[];
  hashtagSets: string[][];
}

export interface Metadata {
  title: string;
  description: string;
  hashtags: string[];
  pinnedComment: string;
}

const len = (s: string) => [...s].length;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fillTemplate(template: string, spec: QuizSpec): string {
  const values: Record<string, string> = {
    n: String(spec.questions.length || 10),
    level: "impossible",
    region: spec.twistRegion ?? "the World",
    category: ({ capitals: "capital", math: "math", "missing-letters": "word", landmarks: "landmark", "what-is-it": "picture", "country-shape": "country" } as Record<string, string>)[spec.quiz ?? ""] ?? "flag",
    part: String(spec.part),
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string, offset: number) => {
    const v = values[k];
    if (v === undefined) return m;
    return offset === 0 ? cap(v) : v;
  });
}

// Skip templates that need a theme or promise something the video does not do (timer is 3 s, not 5).
export const usableTemplate = (t: string) => !t.includes("{theme}") && !/\b5 seconds\b/i.test(t);
const usable = usableTemplate;
/** Long videos run for minutes: skip templates that call them Shorts or promise a minute. */
const SHORT_ONLY = /shorts|60 seconds|sixty seconds|under a minute|one minute|1 minute/i;

const BAND_NAME = { easy: "Easy", medium: "Medium", hard: "Hard", impossible: "Impossible" } as const;
const stamp = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** YouTube chapters for a long video: each level from its first question, then the score screen. The intro is only a few
 *  seconds, so the first level starts at 0:00 (YouTube needs a 0:00 chapter and at least 10 s between chapters). */
export function chapters(tl: Timeline): string {
  const marks: [number, string][] = [];
  let band = "";
  for (const s of tl.scenes) {
    const q = s.q !== undefined ? tl.spec.questions[s.q] : undefined;
    if ((s.kind === "diffUp" || s.kind === "timer") && q && q.band !== band) { band = q.band; marks.push([marks.length ? s.start : 0, BAND_NAME[q.band]]); }
    if (s.kind === "score") marks.push([s.start, "Score"]);
  }
  const kept = marks.filter(([t], i) => i === 0 || t - marks[i - 1][0] >= 10);
  return `Chapters:\n${kept.map(([t, l]) => `${stamp(t)} ${l}`).join("\n")}`;
}

/** `timeline` adds chapters to long-video descriptions. */
export function buildMetadata(spec: QuizSpec, bank: TitleBank, timeline?: Timeline): Metadata {
  const rng = createRng(`${spec.seed}|meta`);
  const fits = spec.profile === "long" ? (t: string) => usable(t) && !SHORT_ONLY.test(t) : usable;
  const pool = spec.part > 1 ? bank.titlesSeries : bank.titles;
  const titles = pool.filter(fits).map((t) => fillTemplate(t, spec)).filter((t) => len(t) <= 70);
  const title = rng.pick(titles);
  const description = fillTemplate(rng.pick(bank.descriptions.filter(fits)), spec);
  const pinnedComment = fillTemplate(rng.pick(bank.pinnedComments.filter(fits).filter((p) => len(fillTemplate(p, spec)) <= 120)), spec);
  if (spec.profile !== "long") return { title, description, hashtags: [...rng.pick(bank.hashtagSets)], pinnedComment };
  // Long videos: not a Short, so no #shorts; chapters let viewers jump to a level.
  const hashtags = rng.pick(bank.hashtagSets).filter((h) => h.toLowerCase() !== "#shorts");
  return { title, description: timeline ? `${description}\n\n${chapters(timeline)}\n` : description, hashtags, pinnedComment };
}
