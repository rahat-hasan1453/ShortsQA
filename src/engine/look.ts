/** How the quiz looks, chosen in the Style panel: flag size, flag shape and the timer. Carried on the theme (like the font), so preview and export always agree. */
export type FlagSize = "small" | "medium" | "large";
/** rounded = rounded rectangle, sharp = sharp rectangle, circle, square = rounded square. */
export type FlagShape = "rounded" | "sharp" | "circle" | "square";
/** auto = the template's own timer in "open" style and the circle countdown in list / options style. */
export type TimerKind = "auto" | "ring" | "bar";

export interface Look { flagSize: FlagSize; flagShape: FlagShape; timer: TimerKind }

export const DEFAULT_LOOK: Look = { flagSize: "large", flagShape: "rounded", timer: "auto" };

export const FLAG_SIZES: { id: FlagSize; label: string }[] = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }];
export const FLAG_SHAPES: { id: FlagShape; label: string }[] = [
  { id: "rounded", label: "Rounded rectangle" }, { id: "sharp", label: "Sharp rectangle" }, { id: "circle", label: "Circle" }, { id: "square", label: "Rounded square" },
];
export const TIMER_KINDS: { id: TimerKind; label: string }[] = [{ id: "auto", label: "Automatic" }, { id: "ring", label: "Circle countdown" }, { id: "bar", label: "Progress bar" }];

const pick = <T extends string>(v: unknown, all: { id: T }[], fallback: T): T => (all.some((x) => x.id === v) ? (v as T) : fallback);
/** Fills in anything missing or unknown (a stale URL, an older saved setting) with the defaults. */
export const cleanLook = (l?: Partial<Record<keyof Look, unknown>>): Look => ({
  flagSize: pick(l?.flagSize, FLAG_SIZES, DEFAULT_LOOK.flagSize),
  flagShape: pick(l?.flagShape, FLAG_SHAPES, DEFAULT_LOOK.flagShape),
  timer: pick(l?.timer, TIMER_KINDS, DEFAULT_LOOK.timer),
});
