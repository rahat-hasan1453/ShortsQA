/** How the quiz looks, chosen in the Style panel: flag size, flag shape and the timer. Carried on the theme (like the font), so preview and export always agree. */
export type FlagSize = "small" | "medium" | "large" | "xlarge";
/** rounded = rounded rectangle, sharp = sharp rectangle, circle, square = rounded square. */
export type FlagShape = "rounded" | "sharp" | "circle" | "square";
/** auto = the template's own timer in "open" style and the circle countdown in list / options style. */
export type TimerKind = "auto" | "ring" | "bar";

/** flagBorder = the frame (card) around the flag; textOutline = the dark outline around titles, answers and banners. */
export interface Look { flagSize: FlagSize; flagShape: FlagShape; timer: TimerKind; flagBorder: boolean; textOutline: boolean }

export const DEFAULT_LOOK: Look = { flagSize: "large", flagShape: "rounded", timer: "auto", flagBorder: true, textOutline: true };

export const FLAG_SIZES: { id: FlagSize; label: string }[] = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }, { id: "xlarge", label: "Extra large" }];
export const FLAG_SHAPES: { id: FlagShape; label: string }[] = [
  { id: "rounded", label: "Rounded rectangle" }, { id: "sharp", label: "Sharp rectangle" }, { id: "circle", label: "Circle" }, { id: "square", label: "Rounded square" },
];
export const TIMER_KINDS: { id: TimerKind; label: string }[] = [{ id: "auto", label: "Automatic" }, { id: "ring", label: "Circle countdown" }, { id: "bar", label: "Progress bar" }];

const pick = <T extends string>(v: unknown, all: { id: T }[], fallback: T): T => (all.some((x) => x.id === v) ? (v as T) : fallback);
/** A checkbox value from a saved setting or a URL ("0" / "false" / false = off). */
const flag = (v: unknown, fallback: boolean): boolean => (v === false || v === "0" || v === "false" ? false : v === true || v === "1" || v === "true" ? true : fallback);
/** Fills in anything missing or unknown (a stale URL, an older saved setting) with the defaults. */
export const cleanLook = (l?: Partial<Record<keyof Look, unknown>>): Look => ({
  flagSize: pick(l?.flagSize, FLAG_SIZES, DEFAULT_LOOK.flagSize),
  flagShape: pick(l?.flagShape, FLAG_SHAPES, DEFAULT_LOOK.flagShape),
  timer: pick(l?.timer, TIMER_KINDS, DEFAULT_LOOK.timer),
  flagBorder: flag(l?.flagBorder, DEFAULT_LOOK.flagBorder),
  textOutline: flag(l?.textOutline, DEFAULT_LOOK.textOutline),
});
