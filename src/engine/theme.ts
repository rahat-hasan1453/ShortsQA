export type { Theme } from "./types";
import type { Theme } from "./types";

export const fontStack = (family: string) => `"${family}", sans-serif`;
export const themeFont = (theme: Theme, role: keyof Theme["fonts"], px: number, weight = 700) =>
  `${weight} ${px}px ${fontStack(theme.fonts[role])}`;
