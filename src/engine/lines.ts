import { segmentLine, type SlotName } from "./segments";
import type { QuizQuestion, QuizSpec, VoiceLines } from "./types";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

export const CLIP_GAP_MS = 40;
export type Slots = Partial<Record<SlotName, string>>;

/** Spoken text pieces of a line, in order, with slot values filled. */
export function lineTexts(line: string, slots: Slots): string[] {
  return segmentLine(line).flatMap((seg) => {
    if (seg.kind === "text") return [seg.text];
    const v = slots[seg.name];
    return v ? [v] : [];
  });
}

export function lineDurationMs(line: string, slots: Slots, clipMs: (text: string) => number): number {
  const texts = lineTexts(line, slots);
  return texts.reduce((a, t) => a + clipMs(t), 0) + CLIP_GAP_MS * Math.max(0, texts.length - 1);
}

export function slotValues(spec: QuizSpec, q?: QuizQuestion): Slots {
  return {
    total: numberWords(spec.questions.length || 10),
    part: numberWords(spec.part),
    region: spec.twistRegion,
    ...(q ? { n: numberWords(q.index + 1), answer: q.spoken ?? q.name } : {}),
  };
}

export function lineById(voice: VoiceLines, id: string): string {
  const [, type, idx] = id.split(".");
  return (voice as any)[type][Number(idx)] as string;
}
