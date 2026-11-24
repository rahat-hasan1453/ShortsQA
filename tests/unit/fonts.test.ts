import { expect, test } from "vitest";
import { themes } from "../../src/data";
import { fontFamilies } from "../../src/engine/assetPaths";
import { FONT_GROUP, fontMatches } from "../../src/app/fonts";

test("every theme font has a group", () => {
  expect(fontFamilies(themes).filter((f) => !FONT_GROUP[f])).toEqual([]);
  expect(FONT_GROUP["Bebas Neue"]).toBe("Display");
  expect(FONT_GROUP["JetBrains Mono"]).toBe("Mono");
  expect(FONT_GROUP["Kalam"]).toBe("Handwritten");
  expect(FONT_GROUP["Cinzel"]).toBe("Serif");
  expect(FONT_GROUP["Inter"]).toBe("Sans");
});

test("search matches name or group", () => {
  expect(fontMatches("Bebas Neue", "bebas")).toBe(true);
  expect(fontMatches("Kalam", "hand")).toBe(true);
  expect(fontMatches("Inter", "serif")).toBe(false);
  expect(fontMatches("Inter", "")).toBe(true);
});
