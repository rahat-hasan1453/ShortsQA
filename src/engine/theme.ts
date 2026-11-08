export type { Theme } from "./types";
import type { Theme } from "./types";

export const fontStack = (family: string) => `"${family}", sans-serif`;
export const themeFont = (theme: Theme, role: keyof Theme["fonts"], px: number, weight = 700) =>
  `${weight} ${px}px ${fontStack(theme.fonts[role])}`;

/** Theme with every font role replaced by `family`; "theme" or undefined keeps the theme's own fonts. */
export function withFont(theme: Theme, family: string | undefined): Theme {
  if (!family || family === "theme") return theme;
  return { ...theme, fonts: { title: family, body: family, numbers: family } };
}
