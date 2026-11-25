import { describe, expect, test } from "vitest";
import { buildQuiz } from "../../src/engine/quizBuilder";
import { buildTimeline, ctaAt, LAST_BANNER_AT, LIKE_BANNER_AT, SUB_BANNER_AT, type CtaKind } from "../../src/engine/timeline";
import { lineTexts } from "../../src/engine/lines";
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

describe("calls to action (like, subscribe, last question)", () => {
  const AT: Record<CtaKind, number> = { like: LIKE_BANNER_AT, subscribe: SUB_BANNER_AT, last: LAST_BANNER_AT };
  test("the level-ups before questions 4, 7 and 10 speak their call to action and stay up long enough to say it", () => {
    for (let i = 0; i < 50; i++) {
      const spec = buildQuiz({ ...base, seed: `l${i}` });
      const tl = buildTimeline(spec, deps);
      for (const kind of ["like", "subscribe", "last"] as CtaKind[]) {
        const scene = tl.scenes.find((s) => s.kind === "diffUp" && s.q === AT[kind])!;
        const cue = tl.cues.find((c: any) => c.kind === "voice" && c.at >= scene.start && c.at < scene.start + 0.2) as any;
        const id = spec.ctaLineIds?.[kind];
        if (spec.noLikeVoice) { expect(spec.ctaLineIds).toBeUndefined(); expect(ctaAt(spec, AT[kind])).toBe(kind === "like" ? "like" : undefined); continue; }
        expect(ctaAt(spec, AT[kind])).toBe(kind);
        expect(id).toBeTruthy();
        const [, type, idx] = id!.split(".");
        expect(type).toBe(`${kind}Cta`);
        expect(cue.clips).toEqual(lineTexts((voice as any)[type][Number(idx)], {}));
        expect(cue.at + cue.clips.reduce((a: number, t: string) => a + clipMsRealistic(t), 0) / 1000).toBeLessThanOrEqual(scene.end + 1e-9);
      }
    }
  });
  test("Shorts say the task once and then only the answers: no 'Flag two' counting cues, no glued-together hook or outro", () => {
    for (let i = 0; i < 40; i++) {
      const spec = buildQuiz({ ...base, seed: `num${i}` });
      expect(spec.questions[0].askLineId).toBeTruthy();
      for (const q of spec.questions.slice(1)) { expect(q.askLineId).toBeUndefined(); expect(q.transitionLineId).toBeUndefined(); }
      const line = (id: string) => { const [, type, idx] = id.split("."); return (voice as any)[type][Number(idx)] as string; };
      for (const id of [spec.hookLineId, spec.outroLineId, spec.questions[0].askLineId!]) expect(line(id)).not.toMatch(/\{(total|n|part)\}/);
    }
  });
  test("the calls to action are the rare exception to skip: almost all videos have them", () => {
    let silent = 0;
    for (let i = 0; i < 200; i++) if (buildQuiz({ ...base, seed: `s${i}` }).noLikeVoice) silent++;
    expect(silent).toBeLessThan(10);
  });
  test("long videos keep the classic like banner only", () => {
    const spec = buildQuiz({ ...base, seed: "lg", profile: "long", answerStyle: "options" } as any);
    expect(spec.ctaLineIds).toBeUndefined();
    expect(ctaAt(spec, SUB_BANNER_AT)).toBeUndefined();
    expect(ctaAt(spec, LIKE_BANNER_AT)).toBe("like");
  });
});
