import crypto from "node:crypto";
import { segmentLine } from "./segments";

export type ClipManifest = Record<string, { file: string; durationMs: number; text: string }>;

export const clipKey = (voice: string, text: string): string =>
  crypto.createHash("sha1").update(`${voice}|${text}`).digest("hex").slice(0, 16);

import { numberWords } from "../../src/engine/lines";
export { numberWords };

const LINE_TYPES = ["intro", "ask", "countdown", "revealCorrect", "transition", "difficultyUp", "outro"];

export function collectClipRequests(
  voiceLines: any[],
  countries: { name: string; continent: string }[],
  voice: string,
): { key: string; text: string }[] {
  const texts = new Set<string>();
  const flags = voiceLines.find((f) => f.format === "flags");
  for (const type of LINE_TYPES) {
    for (const line of flags?.[type] ?? []) {
      for (const seg of segmentLine(line)) if (seg.kind === "text") texts.add(seg.text);
    }
  }
  for (const c of countries) {
    texts.add(c.name);
    texts.add(c.continent);
  }
  texts.add("the world");
  for (let i = 0; i < 100; i++) texts.add(numberWords(i));
  return [...texts].map((text) => ({ key: clipKey(voice, text), text }));
}

export const clipDurationMs = (manifest: ClipManifest, key: string): number => {
  const e = manifest[key];
  if (!e) throw new Error(`missing clip ${key}`);
  return e.durationMs;
};
