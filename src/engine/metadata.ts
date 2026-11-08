import { createRng } from "./rng";
import type { QuizSpec } from "./types";

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
    n: "10",
    level: "impossible",
    region: spec.twistRegion ?? "the World",
    category: "flag",
    part: String(spec.part),
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string, offset: number) => {
    const v = values[k];
    if (v === undefined) return m;
    return offset === 0 ? cap(v) : v;
  });
}

const usable = (t: string) => !t.includes("{theme}");

export function buildMetadata(spec: QuizSpec, bank: TitleBank): Metadata {
  const rng = createRng(`${spec.seed}|meta`);
  const pool = spec.part > 1 ? bank.titlesSeries : bank.titles;
  const titles = pool.filter(usable).map((t) => fillTemplate(t, spec)).filter((t) => len(t) <= 70);
  const title = rng.pick(titles);
  const description = fillTemplate(rng.pick(bank.descriptions.filter(usable)), spec);
  const pinnedComment = fillTemplate(rng.pick(bank.pinnedComments.filter(usable).filter((p) => len(fillTemplate(p, spec)) <= 120)), spec);
  return { title, description, hashtags: [...rng.pick(bank.hashtagSets)], pinnedComment };
}
