import { describe, expect, test } from "vitest";
import { fitText, layoutText } from "../../src/engine/render/text";

const measure = (text: string, px: number) => text.length * px * 0.5;

describe("fitText", () => {
  test("shrinks long text below the size that fits short text and never goes under minPx", () => {
    const long = fitText((px) => measure("Saint Vincent and the Grenadines", px), 840, 120, 48);
    const short = fitText((px) => measure("Chad", px), 840, 120, 48);
    expect(long).toBeLessThan(short);
    expect(long).toBeGreaterThanOrEqual(48);
    expect(fitText((px) => measure("x".repeat(500), px), 840, 120, 48)).toBe(48);
  });
});

describe("layoutText", () => {
  test("short text stays on one line at max size", () => {
    const l = layoutText(measure, "Chad", 840, 120, 48);
    expect(l.lines).toEqual(["Chad"]);
    expect(l.px).toBe(120);
  });
  test("a long name wraps to two lines to fit at a larger size", () => {
    const l = layoutText(measure, "Saint Vincent and the Grenadines", 840, 120, 80);
    expect(l.lines.length).toBe(2);
    expect(l.width).toBeLessThanOrEqual(840);
    expect(l.px).toBeGreaterThanOrEqual(80);
  });
});
