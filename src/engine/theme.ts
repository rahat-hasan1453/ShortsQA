export type { Theme } from "./types";
import type { Look } from "./look";
import type { Theme } from "./types";

export const fontStack = (family: string) => `"${family}", sans-serif`;
export const themeFont = (theme: Theme, role: keyof Theme["fonts"], px: number, weight = 700) =>
  `${weight} ${px}px ${fontStack(theme.fonts[role])}`;

/** Theme carrying the chosen look; the renderer reads it from `theme.look`. */
export function withLook(theme: Theme, look: Look | undefined): Theme {
  return look ? { ...theme, look } : theme;
}

/** Theme with every font role replaced by `family`; "theme" or undefined keeps the theme's own fonts. */
export function withFont(theme: Theme, family: string | undefined): Theme {
  if (!family || family === "theme") return theme;
  return { ...theme, fonts: { title: family, body: family, numbers: family } };
}
