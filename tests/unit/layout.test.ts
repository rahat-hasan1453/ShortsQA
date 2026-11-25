import { describe, expect, test } from "vitest";
import { H, LAYOUT, SAFE, STYLE, W, styleRects } from "../../src/engine/render/layout";
import { cleanLook, DEFAULT_LOOK } from "../../src/engine/look";

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

describe("answer-style rects", () => {
  test("flag cards and bars are centered 4:3 and everything stays in the safe zone", () => {
    for (const st of [STYLE.options, STYLE.list]) {
      expect(st.flagCard.x + st.flagCard.w / 2).toBe(540);
      expect(st.flagCard.w / st.flagCard.h).toBeCloseTo(4 / 3, 2);
      expect(st.bar.x + st.bar.w / 2).toBe(540);
      expect(st.flagCard.y).toBeGreaterThanOrEqual(220);
    }
    const o = STYLE.options.rows, l = STYLE.list.list;
    expect(o.y + o.count * (o.h) + (o.count - 1) * o.gap).toBeLessThanOrEqual(H - SAFE.bottom);
    expect(l.y + l.count * l.rowH).toBeLessThanOrEqual(H - SAFE.bottom);
    expect(o.x + o.w).toBeLessThanOrEqual(W - SAFE.right);
    expect(l.x + l.w).toBeLessThanOrEqual(W - SAFE.right);
  });
});

describe("styleRects (flag size)", () => {
  const styles = ["open", "options", "list"] as const, sizes = ["small", "medium", "large"] as const;
  test("the sizes the app always had are unchanged", () => {
    expect(styleRects("open", "large").flagCard).toEqual(LAYOUT.flagCard);
    expect(styleRects("options", "medium")).toMatchObject({ flagCard: STYLE.options.flagCard, bar: STYLE.options.bar, rows: STYLE.options.rows });
    expect(styleRects("list", "medium")).toMatchObject({ flagCard: STYLE.list.flagCard, bar: STYLE.list.bar, list: STYLE.list.list });
  });
  test("every style and size is centered, 4:3, and inside the safe zone", () => {
    for (const st of styles) for (const sz of sizes) {
      const r = styleRects(st, sz), c = r.flagCard, id = `${st} ${sz}`;
      expect(c.x + c.w / 2, id).toBe(540);
      expect(c.w / c.h, id).toBeCloseTo(4 / 3, 2);
      expect(c.y, id).toBeGreaterThanOrEqual(220);
      expect(c.x + c.w, id).toBeLessThanOrEqual(W - SAFE.right);
      expect(c.y + c.h, id).toBeLessThanOrEqual(H - SAFE.bottom);
      if (r.rows) expect(r.rows.y + r.rows.count * r.rows.h + (r.rows.count - 1) * r.rows.gap, id).toBeLessThanOrEqual(H - SAFE.bottom);
      if (r.list) { expect(r.list.y + r.list.count * r.list.rowH, id).toBeLessThanOrEqual(H - SAFE.bottom); expect(r.list.y, id).toBeGreaterThanOrEqual(c.y + c.h + 60); expect(r.list.rowH, id).toBeGreaterThanOrEqual(70); }
    }
  });
  test("a bigger size gives a bigger card", () => {
    for (const st of styles) expect(styleRects(st, "large").flagCard.w).toBeGreaterThan(styleRects(st, "small").flagCard.w);
  });
});

describe("cleanLook", () => {
  test("fills in defaults for missing or unknown values", () => {
    expect(cleanLook()).toEqual(DEFAULT_LOOK);
    expect(cleanLook({ flagSize: "huge", flagShape: "circle", timer: null })).toEqual({ ...DEFAULT_LOOK, flagShape: "circle" });
  });
});
