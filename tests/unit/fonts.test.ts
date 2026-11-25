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

import fs from "node:fs";
import path from "node:path";
import { EXTRA_FONTS } from "../../src/engine/fontLibrary";
import { fontSlug } from "../../src/engine/assetPaths";

test("the extra font library is large, grouped, and every font file is bundled", () => {
  expect(EXTRA_FONTS.length).toBeGreaterThanOrEqual(80);
  for (const f of EXTRA_FONTS) {
    expect(FONT_GROUP[f], f).toBeTruthy();
    expect(fs.existsSync(path.resolve(__dirname, `../../public/fonts/${fontSlug(f)}-400.woff2`)), f).toBe(true);
  }
  expect(FONT_GROUP["Lobster"]).toBe("Script");
  expect(FONT_GROUP["Bungee"]).toBe("Display");
  expect(fontMatches("Pacifico", "script")).toBe(true);
});
