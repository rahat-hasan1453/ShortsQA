import { expect, test } from "vitest";
import { themes } from "../../src/data";
import { themeTags } from "../../src/app/themeTags";

test("every theme gets exactly one of Dark or Light", () => {
  for (const t of themes) expect(themeTags(t).filter((x) => x === "Dark" || x === "Light").length, t.id).toBe(1);
});

test("featured themes are Popular and moods map to tags", () => {
  expect(themes.filter((t) => t.featured).every((t) => themeTags(t).includes("Popular"))).toBe(true);
  expect(themeTags(themes.find((t) => t.id === "comic-pop")!)).toEqual(expect.arrayContaining(["Bold", "Playful"]));
  expect(themeTags(themes.find((t) => t.id === "gold-luxury")!)).toEqual(expect.arrayContaining(["Elegant"]));
  expect(themeTags(themes.find((t) => t.id === "clean-white")!)).toEqual(expect.arrayContaining(["Calm", "Light"]));
  expect(themeTags(themes.find((t) => t.id === "dark-alert")!)).toContain("Dark");
});
