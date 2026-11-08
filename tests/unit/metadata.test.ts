import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildQuiz } from "../../src/engine/quizBuilder";
import { buildMetadata, fillTemplate, usableTemplate } from "../../src/engine/metadata";
import { clipMsRealistic, countries, themes, voice } from "./helpers";

const titles = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/titles.json"), "utf8")).find((f: any) => f.format === "flags");
const spec = (seed: string, part = 1, useRegionTwist = false) =>
  buildQuiz({ countries, themes, voice, clipMs: clipMsRealistic, seed, part, useRegionTwist });
const len = (s: string) => [...s].length;

describe("buildMetadata", () => {
  test("300 seeds: title <= 70, pinned <= 120, no placeholders left, no {theme} template", () => {
    for (let i = 0; i < 300; i++) {
      const s = spec("m" + i, 1 + (i % 7), i % 3 === 0);
      const m = buildMetadata(s, titles);
      for (const f of [m.title, m.description, m.pinnedComment, ...m.hashtags]) expect(f).not.toMatch(/\{\w+\}/);
      expect(len(m.title)).toBeLessThanOrEqual(70);
      expect(len(m.pinnedComment)).toBeLessThanOrEqual(120);
      expect(m.hashtags).toContain("#shorts");
    }
  });
  test("part 1 uses titles, part 5 uses titlesSeries", () => {
    const one = new Set(titles.titles.filter(usableTemplate).map((t: string) => fillTemplate(t, spec("a", 1))));
    const series = new Set(titles.titlesSeries.filter(usableTemplate).map((t: string) => fillTemplate(t, spec("a", 5))));
    expect(one.has(buildMetadata(spec("a", 1), titles).title)).toBe(true);
    expect(series.has(buildMetadata(spec("a", 5), titles).title)).toBe(true);
  });
  test("titles never promise 5 seconds per flag (the timer is 3 s)", () => {
    for (let i = 0; i < 300; i++) expect(buildMetadata(spec("sec" + i, 1 + (i % 3)), titles).title).not.toMatch(/5 seconds/i);
  });
  test("same spec gives identical output", () => {
    expect(buildMetadata(spec("same"), titles)).toEqual(buildMetadata(spec("same"), titles));
  });
  test("fillTemplate fills values and capitalizes at the start", () => {
    const s = spec("f", 3, true);
    expect(fillTemplate("Part {part}: {n} flags", s)).toBe("Part 3: 10 flags");
    expect(fillTemplate("{level} flag quiz", s)).toBe("Impossible flag quiz");
    expect(fillTemplate("a {level} quiz", s)).toBe("a impossible quiz");
  });
});
