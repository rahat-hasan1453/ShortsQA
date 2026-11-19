import { describe, expect, test } from "vitest";
import { buildQuiz } from "../../src/engine/quizBuilder";
import { buildTimeline, LIKE_BANNER_AT, LIKE_VOICE } from "../../src/engine/timeline";
import { clipMsRealistic, countries, themes, voice } from "./helpers";

const base = { countries, themes, voice, clipMs: clipMsRealistic };
const deps = { clipMs: clipMsRealistic, voice };
const byIso = new Map((countries as any[]).map((c) => [c.iso2, c]));

describe("fun facts", () => {
  test("facts belong to the answer's country, are short, and most videos carry some", () => {
    let withFacts = 0;
    for (let i = 0; i < 100; i++) {
      const spec = buildQuiz({ ...base, seed: `f${i}` });
      const facts = spec.questions.filter((q) => q.fact);
      expect(facts.length).toBeLessThanOrEqual(2);
      for (const q of facts) {
        expect(q.index).toBeGreaterThan(0);
        expect(q.fact).toBe((byIso.get(q.iso2) as any).funFact);
        expect(clipMsRealistic(q.fact!)).toBeLessThanOrEqual(4800);
      }
      if (facts.length) withFacts++;
    }
    expect(withFacts).toBeGreaterThan(30); // the time budget is tight, so a fact is a frequent extra, not a guarantee
  });
  test("a fact is spoken after the reveal line inside the reveal scene, and no voice cues overlap", () => {
    const seed = Array.from({ length: 50 }, (_, i) => `g${i}`).find((s) => buildQuiz({ ...base, seed: s }).questions.some((q) => q.fact))!;
    const spec = buildQuiz({ ...base, seed });
    const tl = buildTimeline(spec, deps);
    const q = spec.questions.find((x) => x.fact)!;
    const reveal = tl.scenes.find((s) => s.kind === "reveal" && s.q === q.index)!;
    expect(reveal.factAt).toBeGreaterThan(reveal.start);
    const cue = tl.cues.find((c: any) => c.kind === "voice" && c.clips.length === 1 && c.clips[0] === q.fact) as any;
    expect(cue.at).toBeGreaterThanOrEqual(reveal.factAt!);
    expect(cue.at + clipMsRealistic(q.fact!) / 1000).toBeLessThanOrEqual(reveal.end);
    const iv = tl.cues.filter((c) => c.kind === "voice").map((c: any) => ({ s: c.at, e: c.at + c.clips.reduce((a: number, t: string) => a + clipMsRealistic(t), 0) / 1000 })).sort((a, b) => a.s - b.s);
    for (let i = 1; i < iv.length; i++) expect(iv[i].s).toBeGreaterThanOrEqual(iv[i - 1].e - 1e-9);
  });
  test("quizzes without country data (math, words) get no facts", () => {
    expect(buildQuiz({ ...base, seed: "m", quiz: "math" }).questions.some((q) => q.fact)).toBe(false);
  });
});

describe("like call to action", () => {
  test("the level-up before question 4 speaks the like line and stays up long enough to say it", () => {
    for (let i = 0; i < 50; i++) {
      const spec = buildQuiz({ ...base, seed: `l${i}` });
      const tl = buildTimeline(spec, deps);
      const scene = tl.scenes.find((s) => s.kind === "diffUp" && s.q === LIKE_BANNER_AT)!;
      const cue = tl.cues.find((c: any) => c.kind === "voice" && c.clips.length === 1 && c.clips[0] === LIKE_VOICE) as any;
      if (spec.noLikeVoice) { expect(cue).toBeUndefined(); continue; }
      expect(cue.at).toBeGreaterThanOrEqual(scene.start);
      expect(cue.at + clipMsRealistic(LIKE_VOICE) / 1000).toBeLessThanOrEqual(scene.end + 1e-9);
    }
  });
  test("the like voice is the rare exception: almost all videos have it", () => {
    let silent = 0;
    for (let i = 0; i < 200; i++) if (buildQuiz({ ...base, seed: `s${i}` }).noLikeVoice) silent++;
    expect(silent).toBeLessThan(10);
  });
});
