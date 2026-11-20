import crypto from "node:crypto";
import { segmentLine } from "./segments";

export type ClipManifest = Record<string, { file: string; durationMs: number; text: string }>;

export const clipKey = (voice: string, text: string): string =>
  crypto.createHash("sha1").update(`${voice}|${text}`).digest("hex").slice(0, 16);

import { numberWords } from "../../src/engine/lines";
export { numberWords };

/** Quiz types that are selectable in the app; their voice lines get clips. */
const READY_FORMATS = ["flags", "capitals", "math", "missing-letters", "real-vs-fake-flag", "landmarks", "what-is-it", "country-shape"];
const LINE_TYPES = ["intro", "ask", "countdown", "revealCorrect", "transition", "difficultyUp", "outro"];

export function collectClipRequests(
  voiceLines: any[],
  countries: { name: string; continent: string; capital?: string }[],
  voice: string,
  extraTexts: string[] = [],
): { key: string; text: string }[] {
  const texts = new Set<string>();
  for (const format of READY_FORMATS) {
    const lines = voiceLines.find((f) => f.format === format);
    for (const type of LINE_TYPES) {
      for (const line of lines?.[type] ?? []) {
        for (const seg of segmentLine(line)) if (seg.kind === "text") texts.add(seg.text);
      }
    }
  }
  for (const c of countries) {
    texts.add(c.name);
    texts.add(c.continent);
    if (c.capital) texts.add(c.capital);
  }
  texts.add("the world");
  texts.add("real");
  texts.add("fake");
  for (const t of extraTexts) texts.add(t);
  for (let i = 0; i < 100; i++) texts.add(numberWords(i));
  return [...texts].map((text) => ({ key: clipKey(voice, text), text }));
}

export const clipDurationMs = (manifest: ClipManifest, key: string): number => {
  const e = manifest[key];
  if (!e) throw new Error(`missing clip ${key}`);
  return e.durationMs;
};

/** The tag mixed into every clip key: changing the voice (engine or id) regenerates all clips. */
export const voiceTagOf = (cfg: { voice?: string; kokoroVoice?: string; cartesiaVoice?: string }): string =>
  cfg.kokoroVoice ? `kokoro:${cfg.kokoroVoice}` : cfg.cartesiaVoice ? `cartesia:${cfg.cartesiaVoice}` : (cfg.voice ?? "");
