import { describe, expect, test } from "vitest";
import { buildQuiz } from "../../src/engine/quizBuilder";
import { buildTimeline, DurationError } from "../../src/engine/timeline";
import { clipMsRealistic, countries, themes, voice } from "./helpers";

const base = { countries, themes, voice, clipMs: clipMsRealistic };
const deps = { clipMs: clipMsRealistic, voice };

describe("buildTimeline", () => {
  test("typical duration is between 50 and 59 seconds", () => {
    const tl = buildTimeline(buildQuiz({ ...base, seed: "typ" }), deps);
    expect(tl.duration).toBeGreaterThanOrEqual(50);
    expect(tl.duration).toBeLessThanOrEqual(59);
  });
  test("difficulty-up scenes and whoosh cues exist exactly before questions 3, 6, 9", () => {
    const tl = buildTimeline(buildQuiz({ ...base, seed: "du" }), deps);
    const du = tl.scenes.filter((s) => s.kind === "diffUp");
    expect(du.map((s) => s.q)).toEqual([3, 6, 9]);
    for (const s of du) {
      const timer = tl.scenes.find((x) => x.kind === "timer" && x.q === s.q)!;
      expect(s.end).toBeLessThanOrEqual(timer.start + 1e-9);
      expect(tl.cues.some((c) => c.kind === "whoosh" && c.at >= s.start && c.at < s.end)).toBe(true);
    }
  });
  test("a 2.0 s name clip stretches the reveal and voice cues never overlap", () => {
    const name = buildQuiz({ ...base, seed: "long" }).questions[2].name;
    const clipMs = (t: string) => (t === name ? 2000 : clipMsRealistic(t));
    const spec = buildQuiz({ ...base, seed: "long", clipMs });
    const tl = buildTimeline(spec, { clipMs, voice });
    const reveal = tl.scenes.find((s) => s.kind === "reveal" && s.q === 2)!;
    expect(reveal.end - reveal.start).toBeGreaterThanOrEqual(2.1); // the 2.0 s clip plus padding, well above the 1.1 s minimum
    const iv = tl.cues.filter((c) => c.kind === "voice").map((c: any) => ({ s: c.at, e: c.at + (c.clips.reduce((a: number, t: string) => a + clipMs(t), 0) / 1000) + 0.04 * (c.clips.length - 1) })).sort((a, b) => a.s - b.s);
    for (let i = 1; i < iv.length; i++) expect(iv[i].s).toBeGreaterThanOrEqual(iv[i - 1].e - 1e-9);
  });
  test("500 random seeds all build within 59 s", () => {
    for (let i = 0; i < 500; i++) {
      const tl = buildTimeline(buildQuiz({ ...base, seed: "r" + i }), deps);
      expect(tl.duration).toBeLessThanOrEqual(59);
    }
  });
  test("absurd clip lengths throw DurationError", () => {
    const spec = buildQuiz({ ...base, seed: "abs" });
    expect(() => buildTimeline(spec, { clipMs: () => 5000, voice })).toThrow(DurationError);
  });
});

import fs from "node:fs";
import path from "node:path";
import { makeClipIndex } from "../../src/engine/clipIndex";

describe("with the real voice manifest", () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../public/audio/af_heart/manifest.json"), "utf8"));
  const clips = makeClipIndex(manifest, "af_heart");
  test("500 seeds build within 59 s and every spoken text has a clip", () => {
    let max = 0;
    for (let i = 0; i < 500; i++) {
      const spec = buildQuiz({ ...base, clipMs: (t) => clips.ms(t), seed: "real" + i });
      const tl = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice });
      max = Math.max(max, tl.duration);
      for (const c of tl.cues) if (c.kind === "voice") for (const text of c.clips) expect(clips.has(text), text).toBe(true);
    }
    expect(max).toBeLessThanOrEqual(59);
  });
});
