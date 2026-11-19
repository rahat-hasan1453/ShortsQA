import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildQuiz, bandOf } from "../../src/engine/quizBuilder";
import { buildTimeline } from "../../src/engine/timeline";
import { clipMsRealistic, countries, themes } from "./helpers";
import voiceJson from "../../data/voice_lines.json";
import landmarksJson from "../../data/landmarks.json";
import creditsJson from "../../data/landmark_credits.json";
import type { LandmarkItem, VoiceLines } from "../../src/engine/types";

const voice = (voiceJson as unknown as VoiceLines[]).find((v) => v.format === "landmarks")!;
const landmarks = (landmarksJson as unknown as LandmarkItem[]).filter((l) => l.id in creditsJson);
const base = { countries, themes, voice, landmarks, quiz: "landmarks" as const, clipMs: clipMsRealistic };

describe("landmarks quiz", () => {
  test("10 photos, one per country, bands 3/3/3/1, answer is the landmark's country", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const spec = buildQuiz({ ...base, seed });
      expect(spec.questions).toHaveLength(10);
      expect(spec.quiz).toBe("landmarks");
      expect(spec.questions.map((q) => q.band)).toEqual(["easy", "easy", "easy", "medium", "medium", "medium", "hard", "hard", "hard", "impossible"]);
      expect(new Set(spec.questions.map((q) => q.name)).size).toBe(10);
      for (const q of spec.questions) {
        const lm = landmarks.find((l) => l.id === q.image)!;
        expect(lm).toBeDefined();
        expect(bandOf(lm.difficulty)).toBe(q.band);
        expect(countries.find((c: any) => c.iso2 === lm.iso2)!.name).toBe(q.name);
        expect(q.prompt).toBe(lm.name);
      }
    }
  });
  test("is deterministic and the timeline fits in 59 s", () => {
    expect(buildQuiz({ ...base, seed: "x" })).toEqual(buildQuiz({ ...base, seed: "x" }));
    for (let i = 0; i < 40; i++) {
      const spec = buildQuiz({ ...base, seed: `t${i}` });
      expect(buildTimeline(spec, { clipMs: clipMsRealistic, voice }).duration).toBeLessThanOrEqual(59);
    }
  });
  test("multiple choice has the right country plus 3 different wrong ones", () => {
    const spec = buildQuiz({ ...base, seed: "mc", answerStyle: "options" });
    for (const q of spec.questions) {
      expect(new Set(q.options!.names).size).toBe(4);
      expect(q.options!.names[q.options!.correct]).toBe(q.name);
    }
  });
  test("every landmark with a credit has a photo file, and every credit has author + licence", () => {
    for (const l of landmarks) expect(fs.existsSync(path.resolve(__dirname, `../../public/landmarks/${l.id}.jpg`))).toBe(true);
    for (const c of Object.values(creditsJson as Record<string, any>)) { expect(c.author).toBeTruthy(); expect(c.license).toBeTruthy(); }
  });
  test("fails clearly when there are too few photos", () => {
    expect(() => buildQuiz({ ...base, landmarks: landmarks.slice(0, 5), seed: "few" })).toThrow(/not enough landmark photos/);
  });
});
