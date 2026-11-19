import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildQuiz, bandOf } from "../../src/engine/quizBuilder";
import { buildTimeline } from "../../src/engine/timeline";
import { clipMsRealistic, countries, themes } from "./helpers";
import voiceJson from "../../data/voice_lines.json";
import type { VoiceLines } from "../../src/engine/types";

const voice = (voiceJson as unknown as VoiceLines[]).find((v) => v.format === "country-shape")!;
const shapes = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../public/shapes.json"), "utf8")) as Record<string, { d: string; w: number; h: number; ok: boolean }>;
const base = { countries, themes, voice, quiz: "country-shape" as const, shapeIso2: new Set(Object.keys(shapes).filter((k) => shapes[k].ok)), clipMs: clipMsRealistic };
const byIso = new Map(countries.map((c: any) => [c.iso2, c]));

describe("country-shape quiz", () => {
  test("10 distinct countries with outlines, banded by shapeDifficulty 3/3/3/1", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const spec = buildQuiz({ ...base, seed });
      expect(spec.questions).toHaveLength(10);
      expect(spec.questions.map((q) => q.band)).toEqual(["easy", "easy", "easy", "medium", "medium", "medium", "hard", "hard", "hard", "impossible"]);
      expect(new Set(spec.questions.map((q) => q.iso2)).size).toBe(10);
      for (const q of spec.questions) {
        expect(q.shape).toBe(true);
        expect(shapes[q.iso2!]).toBeDefined();
        expect(bandOf((byIso.get(q.iso2) as any).shapeDifficulty)).toBe(q.band);
      }
    }
  });
  test("deterministic and fits in 59 s", () => {
    expect(buildQuiz({ ...base, seed: "x" })).toEqual(buildQuiz({ ...base, seed: "x" }));
    for (let i = 0; i < 30; i++) expect(buildTimeline(buildQuiz({ ...base, seed: `t${i}` }), { clipMs: clipMsRealistic, voice }).duration).toBeLessThanOrEqual(59);
  });
  test("multiple choice offers neighbours from the same sub-region first", () => {
    const spec = buildQuiz({ ...base, seed: "mc", answerStyle: "options" });
    for (const q of spec.questions) {
      expect(new Set(q.options!.names).size).toBe(4);
      expect(q.options!.names[q.options!.correct]).toBe(q.name);
      const sub = (byIso.get(q.iso2) as any).subregion;
      const neighbours = (countries as any[]).filter((c) => c.subregion === sub && c.iso2 !== q.iso2 && base.shapeIso2.has(c.iso2)).length;
      const same = q.options!.names.filter((n) => (countries as any[]).find((c) => c.name === n)?.subregion === sub).length - 1; // minus the answer
      expect(same).toBe(Math.min(3, neighbours));
    }
  });
  test("shapes.json has an outline for every country, all inside a 1000-unit box; scattered atolls are marked not ok", () => {
    expect((countries as any[]).filter((c) => !shapes[c.iso2])).toEqual([]);
    expect(shapes.MV.ok).toBe(false);
    expect(shapes.FR.ok).toBe(true);
    expect(Object.values(shapes).filter((s) => !s.ok).length).toBeLessThan(25);
    for (const s of Object.values(shapes)) { expect(Math.max(s.w, s.h)).toBeLessThanOrEqual(1000.1); expect(s.d.startsWith("M")).toBe(true); }
  });
});
