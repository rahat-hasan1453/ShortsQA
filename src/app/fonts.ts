import { themes } from "@/data";
import { fontFamilies } from "@/engine/assetPaths";

export type FontGroup = "Display" | "Sans" | "Serif" | "Handwritten" | "Mono";
export const FONT_GROUPS: FontGroup[] = ["Display", "Sans", "Serif", "Handwritten", "Mono"];

const DISPLAY = ["Anton", "Bebas Neue", "Bangers", "Luckiest Guy", "Lilita One", "Archivo Black", "Alfa Slab One", "Audiowide", "Orbitron", "Press Start 2P", "Righteous", "Unbounded", "Chewy", "Fredoka", "Baloo 2"];
const SPECIAL: Record<string, FontGroup> = {
  ...Object.fromEntries(DISPLAY.map((f) => [f, "Display" as const])),
  "JetBrains Mono": "Mono",
  "Permanent Marker": "Handwritten", Kalam: "Handwritten", "Comic Neue": "Handwritten",
  Fraunces: "Serif", "Playfair Display": "Serif", Cinzel: "Serif",
};

/** Group of every bundled font family (everything not listed above is a sans). */
export const FONT_GROUP: Record<string, FontGroup> = Object.fromEntries(fontFamilies(themes).map((f) => [f, SPECIAL[f] ?? "Sans"]));

export const fontMatches = (family: string, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return !q || family.toLowerCase().includes(q) || (FONT_GROUP[family] ?? "").toLowerCase().includes(q);
};
