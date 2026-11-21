import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { countries, landmarks, pictures, themes, voiceFor, words } from "../../src/data";
import { makeClipIndex } from "../../src/engine/clipIndex";
import { bandCounts, buildQuiz } from "../../src/engine/quizBuilder";
import { frameSize } from "../../src/engine/render/layout";
import { buildTimeline, maxDuration } from "../../src/engine/timeline";
import type { QuizKind } from "../../src/engine/types";

const root = path.resolve(__dirname, "../..");
const clips = makeClipIndex(JSON.parse(fs.readFileSync(path.join(root, "public/audio/af_heart/manifest.json"), "utf8")), "af_heart");
const shapes = JSON.parse(fs.readFileSync(path.join(root, "public/shapes.json"), "utf8")) as Record<string, { ok?: boolean }>;
const shapeIso2 = new Set(Object.keys(shapes).filter((k) => shapes[k].ok !== false));
const KINDS: QuizKind[] = ["flags", "capitals", "math", "missing-letters", "real-vs-fake-flag", "landmarks", "what-is-it", "country-shape"];

const build = (quiz: QuizKind, seed: string, profile: "short" | "long" = "long") => {
  const voice = voiceFor(quiz);
  const spec = buildQuiz({ quiz, seed, profile, countries, themes, voice, words, landmarks, pictures: pictures.filter((p) => clips.has(p.name)), shapeIso2: quiz === "country-shape" ? shapeIso2 : undefined, answerStyle: "list", clipMs: (t) => clips.ms(t) });
  return { spec, timeline: buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice }) };
};

test("frame size follows the profile", () => {
  expect(frameSize()).toEqual({ w: 1080, h: 1920 });
  expect(frameSize("short")).toEqual({ w: 1080, h: 1920 });
  expect(frameSize("long")).toEqual({ w: 1920, h: 1080 });
  expect(maxDuration("short")).toBe(59);
  expect(maxDuration("long")).toBe(510);
  expect(bandCounts("short").map(([, n]) => n)).toEqual([3, 3, 3, 1]);
  expect(bandCounts("long").map(([, n]) => n)).toEqual([13, 11, 10, 6]);
});

describe("long builds", () => {
  for (const quiz of KINDS) test(`${quiz}: 24-40 options questions, 3-8.5 min, every spoken text has a clip`, () => {
    for (const seed of ["a", "b", "c"]) {
      const { spec, timeline } = build(quiz, `${quiz}-${seed}`);
      expect(spec.profile).toBe("long");
      expect(spec.answerStyle).toBe("options");
      expect(spec.questions.length).toBeGreaterThanOrEqual(24);
      expect(spec.questions.length).toBeLessThanOrEqual(40);
      expect(new Set(spec.questions.map((q) => q.name + (q.prompt ?? "") + (q.cardText ?? ""))).size).toBe(spec.questions.length);
      expect(timeline.duration).toBeGreaterThan(180);
      expect(timeline.duration).toBeLessThanOrEqual(510);
      for (const c of timeline.cues) if (c.kind === "voice") for (const t of c.clips) expect(clips.has(t), t).toBe(true);
    }
  });

  test("flags: 40 questions, 5-8.5 min, a score scene right before the outro, level-ups at band changes", () => {
    const { spec, timeline } = build("flags", "demo");
    expect(spec.questions).toHaveLength(40);
    expect(timeline.duration).toBeGreaterThan(300);
    const kinds = timeline.scenes.map((s) => s.kind);
    expect(kinds.filter((k) => k === "score")).toHaveLength(1);
    expect(kinds.slice(-2)).toEqual(["score", "outro"]);
    expect(Object.keys(spec.difficultyUpLineIds).map(Number).sort((a, b) => a - b)).toEqual([13, 24, 34]);
    const timers = timeline.scenes.filter((s) => s.kind === "timer");
    expect(timers[0].end - timers[0].start).toBe(5);
    expect(timers[timers.length - 1].end - timers[timers.length - 1].start).toBe(6);
  });

  test("short builds keep 10 questions and the 59 s limit", () => {
    const { spec, timeline } = build("flags", "demo", "short");
    expect(spec.questions).toHaveLength(10);
    expect(spec.profile ?? "short").toBe("short");
    expect(timeline.duration).toBeLessThanOrEqual(59);
    expect(timeline.scenes.some((s) => s.kind === "score")).toBe(false);
  });
});

import { STREAM_CHUNK } from "../../src/engine/export/encoder";
test("streamed chunks stay well under the proxy's 10 MB request limit", () => {
  expect(STREAM_CHUNK).toBeLessThanOrEqual(4 * 1024 * 1024);
});
