import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { flagPath, fontFamilies, fontFile } from "../../src/engine/assetPaths";

const root = path.resolve(__dirname, "../..");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));

describe("static assets", () => {
  test("flagPath is lowercase svg path", () => {
    expect(flagPath("FR")).toBe("/flags/fr.svg");
  });
  test("every country has a flag svg", () => {
    const missing = read("countries.json").map((c: any) => c.iso2).filter((i: string) => !fs.existsSync(path.join(root, "public", flagPath(i))));
    expect(missing).toEqual([]);
  });
  test("every theme font family has a file (40 families)", () => {
    const fams = fontFamilies(read("themes.json"));
    expect(fams.length).toBe(40);
    const missing = fams.filter((f) => !fs.existsSync(path.join(root, "public", fontFile(f))));
    expect(missing).toEqual([]);
  });
  test("license notices exist", () => {
    expect(fs.existsSync(path.join(root, "public/flags/LICENSE.txt"))).toBe(true);
    expect(fs.existsSync(path.join(root, "public/fonts/LICENSE.txt"))).toBe(true);
  });
});
