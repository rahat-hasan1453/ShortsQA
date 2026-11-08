import { describe, expect, test } from "vitest";
import { H, LAYOUT, SAFE, W } from "../../src/engine/render/layout";

describe("layout", () => {
  test("every rect is inside the safe zone and content starts at y >= 220", () => {
    for (const [name, r] of Object.entries(LAYOUT)) {
      expect(r.y, name).toBeGreaterThanOrEqual(220);
      expect(r.y + r.h, name).toBeLessThanOrEqual(H - SAFE.bottom);
      expect(r.x + r.w, name).toBeLessThanOrEqual(W - SAFE.right);
      expect(r.x, name).toBeGreaterThanOrEqual(0);
    }
  });
  test("flag card keeps a 4:3 aspect", () => {
    expect(LAYOUT.flagCard.w / LAYOUT.flagCard.h).toBeCloseTo(4 / 3, 2);
  });
});

import { themes } from "./helpers";
import { withFont } from "../../src/engine/theme";

describe("withFont", () => {
  test("replaces all three font roles and leaves the theme untouched", () => {
    const base = themes[0];
    const out = withFont(base, "Press Start 2P");
    expect(out.fonts).toEqual({ title: "Press Start 2P", body: "Press Start 2P", numbers: "Press Start 2P" });
    expect(base.fonts.title).not.toBe("Press Start 2P");
    expect(withFont(base, undefined)).toBe(base);
    expect(withFont(base, "theme")).toBe(base);
  });
});

describe("horizontal centering", () => {
  test("every rect is centered on the canvas (x = 540)", () => {
    for (const [name, r] of Object.entries(LAYOUT)) expect(r.x + r.w / 2, name).toBe(540);
  });
});
