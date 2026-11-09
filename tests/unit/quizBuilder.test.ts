import { describe, expect, test } from "vitest";
import { buildQuiz, bandOf } from "../../src/engine/quizBuilder";
import { lineDurationMs, lineTexts, slotValues } from "../../src/engine/lines";
import { clipMsRealistic, countries, themes, voice } from "./helpers";

const base = { countries, themes, voice, clipMs: clipMsRealistic };
const byIso = new Map(countries.map((c: any) => [c.iso2, c]));

describe("buildQuiz", () => {
  test("same inputs give deep-equal specs", () => {
    expect(buildQuiz({ ...base, seed: "demo" })).toEqual(buildQuiz({ ...base, seed: "demo" }));
    expect(buildQuiz({ ...base, seed: "demo" })).not.toEqual(buildQuiz({ ...base, seed: "other" }));
  });
  test("10 distinct countries with bands easy x3, medium x3, hard x3, impossible x1", () => {
    const spec = buildQuiz({ ...base, seed: "s1" });
    expect(spec.questions).toHaveLength(10);
    expect(new Set(spec.questions.map((q) => q.iso2)).size).toBe(10);
    expect(spec.questions.map((q) => q.band)).toEqual(["easy","easy","easy","medium","medium","medium","hard","hard","hard","impossible"]);
    for (const q of spec.questions) expect(bandOf((byIso.get(q.iso2) as any).flagDifficulty)).toBe(q.band);
  });
  test("part is clamped to 1-99", () => {
    expect(buildQuiz({ ...base, seed: "p", part: 0 }).part).toBe(1);
    expect(buildQuiz({ ...base, seed: "p", part: -3 }).part).toBe(1);
    expect(buildQuiz({ ...base, seed: "p", part: 1000 }).part).toBe(99);
  });
  test("region twist works or falls back for each continent", () => {
    for (const region of ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]) {
      const spec = buildQuiz({ ...base, seed: "t", useRegionTwist: true, regionOverride: region });
      expect(spec.questions).toHaveLength(10);
      if (spec.twistRegion) {
        expect(spec.twistRegion).toBe(region);
        for (const q of spec.questions) expect((byIso.get(q.iso2) as any).continent).toBe(region);
      } else {
        expect(spec.twistRegion).toBeUndefined();
      }
    }
  });
  test("Random theme only picks featured templates (the 6 new ones)", () => {
    const featured = themes.filter((t: any) => t.featured).map((t: any) => t.id);
    expect(featured.sort()).toEqual(["clean-white", "dark-alert", "game-show", "mono-bold", "quiz-burst", "sticker-pop"]);
    const picked = new Set<string>();
    for (let i = 0; i < 120; i++) picked.add(buildQuiz({ ...base, seed: "rt" + i }).themeId);
    for (const id of picked) expect(featured, id).toContain(id);
    expect(picked.size).toBeGreaterThanOrEqual(4);
  });
  test("odd seeds build without throwing", () => {
    for (const seed of ["", "x".repeat(10000), "🏁🇫🇷"]) expect(buildQuiz({ ...base, seed }).questions).toHaveLength(10);
  });
  test("reveal lines fit 1400 ms whenever a fitting line exists; no {score} lines; region lines only with twist", () => {
    for (let i = 0; i < 40; i++) {
      const spec = buildQuiz({ ...base, seed: "fit" + i });
      for (const q of spec.questions) {
        const slots = slotValues(spec, q);
        const dur = (idx: number) => lineDurationMs(voice.revealCorrect[idx], slots, clipMsRealistic);
        const chosen = Number(q.revealLineId.split(".").pop());
        const anyFits = voice.revealCorrect.some((_: string, idx: number) => dur(idx) <= 1400);
        if (anyFits) expect(dur(chosen)).toBeLessThanOrEqual(1900);
      }
      const outro = voice.outro[Number(spec.outroLineId.split(".").pop())];
      expect(outro).not.toContain("{score}");
      const hook = voice.intro[Number(spec.hookLineId.split(".").pop())];
      expect(hook).not.toContain("{region}");
    }
  });
  test("lineTexts fills slots", () => {
    const spec = buildQuiz({ ...base, seed: "x" });
    const q = spec.questions[0];
    expect(lineTexts("It's {answer}!", slotValues(spec, q))).toEqual(["It's", q.name]);
  });
});

describe("reveal wording", () => {
  test('no reveal line says "Yes" (it repeats ten times per video)', () => {
    for (let i = 0; i < 200; i++) {
      const spec = buildQuiz({ ...base, seed: "yes" + i });
      for (const q of spec.questions) {
        const line = voice.revealCorrect[Number(q.revealLineId.split(".").pop())];
        expect(line, q.revealLineId).not.toMatch(/\byes\b/i);
      }
    }
  });
});
