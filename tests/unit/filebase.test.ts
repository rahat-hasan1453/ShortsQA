import { expect, test } from "vitest";
import { fileBase, renderId } from "../../src/app/prepare";

const p = (seed: string, profile?: "long") => ({ spec: { seed, part: 2, quiz: "capitals", ...(profile ? { profile } : {}) } }) as any;

test("Shorts download names are unchanged (seed kept as typed)", () => {
  expect(fileBase(p("Demo X"))).toBe("capitals-part2-Demo X");
});

test("render ids are safe and different seeds never share one", () => {
  expect(renderId(p("demo", "long"))).toBe("long-capitals-part2-demo");
  expect(renderId(p("a b", "long"))).toMatch(/^[a-z0-9-]{1,80}$/);
  expect(renderId(p("a b", "long"))).not.toBe(renderId(p("a-b", "long")));
});
