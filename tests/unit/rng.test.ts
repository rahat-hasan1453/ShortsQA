import { describe, expect, test } from "vitest";
import { createRng } from "../../src/engine/rng";

const take = (seed: string, n = 20) => { const r = createRng(seed); return Array.from({ length: n }, () => r.next()); };

describe("createRng", () => {
  test("same seed gives the same first 20 values, all in [0,1)", () => {
    expect(take("demo")).toEqual(take("demo"));
    expect(take("demo").every((x) => x >= 0 && x < 1)).toBe(true);
  });
  test("odd seeds neither throw nor collide", () => {
    const seeds = ["", "x".repeat(10000), "🏁🇫🇷"];
    const runs = seeds.map((s) => JSON.stringify(take(s)));
    expect(new Set(runs).size).toBe(3);
  });
  test("int, pick and shuffle behave", () => {
    const r = createRng("a");
    for (let i = 0; i < 100; i++) { const v = r.int(5); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(5); }
    expect([...r.shuffle([1, 2, 3, 4])].sort()).toEqual([1, 2, 3, 4]);
    expect([1, 2, 3]).toContain(r.pick([1, 2, 3]));
  });
});
