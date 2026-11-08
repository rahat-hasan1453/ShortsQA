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
