import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildQuiz } from "../../src/engine/quizBuilder";
import { buildTimeline } from "../../src/engine/timeline";
import { clipMsRealistic, countries, themes } from "./helpers";
import voiceJson from "../../data/voice_lines.json";
import itemsJson from "../../data/what_is_it.json";
import creditsJson from "../../data/what_is_it_credits.json";
import type { PictureEffect, PictureItem, VoiceLines } from "../../src/engine/types";

const voice = (voiceJson as unknown as VoiceLines[]).find((v) => v.format === "what-is-it")!;
const idOf = (n: number) => `wi${String(n).padStart(4, "0")}`;
const raw = (itemsJson as unknown as { n: number; answer: string; category: string; difficulty: number; bestFormats: string[]; wrongOptions: string[] }[]).filter((x) => idOf(x.n) in creditsJson);
const pictures: PictureItem[] = raw.map((x) => ({
  id: idOf(x.n), name: x.answer, category: x.category, difficulty: x.difficulty,
  effects: x.bestFormats.filter((f): f is PictureEffect => ["zoom", "blur", "pixel"].includes(f)),
  wrong: [...x.wrongOptions, ...raw.filter((y) => y.category === x.category && y.answer !== x.answer).map((y) => y.answer)],
}));
const base = { countries, themes, voice, pictures, quiz: "what-is-it" as const, clipMs: clipMsRealistic };

describe("what-is-it quiz", () => {
  test("10 distinct pictures: difficulty 1 x3, 2 x3, 3 x4, each with an effect and a focus point", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const spec = buildQuiz({ ...base, seed });
      expect(spec.questions).toHaveLength(10);
      expect(new Set(spec.questions.map((q) => q.image)).size).toBe(10);
      const level = spec.questions.map((q) => pictures.find((p) => p.id === q.image)!.difficulty);
      expect(level).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 3]);
      for (const q of spec.questions) {
        expect(["zoom", "blur", "pixel"]).toContain(q.effect);
        expect(q.focus![0]).toBeGreaterThanOrEqual(0.3);
        expect(q.focus![0]).toBeLessThanOrEqual(0.7);
        expect(q.name).toBe(pictures.find((p) => p.id === q.image)!.name);
      }
    }
  });
  test("deterministic, and the timeline fits in 59 s", () => {
    expect(buildQuiz({ ...base, seed: "x" })).toEqual(buildQuiz({ ...base, seed: "x" }));
    for (let i = 0; i < 30; i++) expect(buildTimeline(buildQuiz({ ...base, seed: `t${i}` }), { clipMs: clipMsRealistic, voice }).duration).toBeLessThanOrEqual(59);
  });
  test("multiple choice: correct name plus 3 different wrong ones", () => {
    const spec = buildQuiz({ ...base, seed: "mc", answerStyle: "options" });
    for (const q of spec.questions) {
      expect(new Set(q.options!.names).size).toBe(4);
      expect(q.options!.names[q.options!.correct]).toBe(q.name);
    }
  });
  test("every credited picture has a file and an author + licence; every answer has a voice clip", () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../public/audio/af_heart/manifest.json"), "utf8")) as Record<string, { text: string }>;
    const spoken = new Set(Object.values(manifest).map((m) => m.text));
    for (const p of pictures) {
      expect(fs.existsSync(path.resolve(__dirname, `../../public/what-is-it/${p.id}.jpg`))).toBe(true);
      expect(spoken.has(p.name), `clip for ${p.name}`).toBe(true);
    }
    for (const c of Object.values(creditsJson as Record<string, any>)) { expect(c.author).toBeTruthy(); expect(c.license).toBeTruthy(); }
  });
  test("fails clearly with too few pictures", () => {
    expect(() => buildQuiz({ ...base, pictures: pictures.slice(0, 4), seed: "few" })).toThrow(/not enough pictures/);
  });
});
