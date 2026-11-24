import type { Theme } from "@/engine/types";

export const THEME_TAGS = ["Popular", "Bold", "Calm", "Playful", "Elegant", "Dark", "Light"] as const;
export type ThemeTag = (typeof THEME_TAGS)[number];

const MOODS: [ThemeTag, RegExp][] = [
  ["Bold", /loud|bold|energetic|high-energy|game-show|dramatic|poster/],
  ["Calm", /calm|clean|fresh|airy|focused|minimal|crisp/],
  ["Playful", /playful|funny|cheerful|bouncy|sweet|comic/],
  ["Elegant", /elegant|premium|dreamy|epic/],
];

/** WCAG relative luminance of a #RRGGBB colour (0 black .. 1 white). */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Filter tags for the template gallery, from the theme's mood words and background colours. */
export function themeTags(t: Theme): ThemeTag[] {
  const tags: ThemeTag[] = [];
  if (t.featured) tags.push("Popular");
  const mood = t.mood.toLowerCase();
  for (const [tag, re] of MOODS) if (re.test(mood)) tags.push(tag);
  const lum = (luminance(t.palette.bgFrom) + luminance(t.palette.bgTo)) / 2;
  tags.push(lum < 0.3 ? "Dark" : "Light");
  return tags;
}
