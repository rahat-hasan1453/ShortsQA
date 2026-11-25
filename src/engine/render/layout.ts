import type { AnswerStyle } from "../types";
import type { FlagSize } from "../look";

export const W = 1080;
export const H = 1920;
export const LONG_W = 1920;
export const LONG_H = 1080;

/** Canvas size of a profile: vertical Shorts or horizontal long-form. */
export const frameSize = (profile?: "short" | "long"): { w: number; h: number } => (profile === "long" ? { w: LONG_W, h: LONG_H } : { w: W, h: H });
export const SAFE = { top: 200, bottom: 240, right: 160 } as const;

export interface Rect { x: number; y: number; w: number; h: number }

/** All content rects. Content starts at y >= 220 and sits between x 160 and 920: the right 160 px is the safe zone, mirrored on the left so the content is centered on the canvas (x = 540). */
export const LAYOUT: Record<"topline" | "header" | "hook" | "flagCard" | "reveal" | "timer" | "dots", Rect> = {
  topline: { x: 160, y: 224, w: 760, h: 56 },
  header: { x: 160, y: 290, w: 760, h: 130 },
  hook: { x: 160, y: 680, w: 760, h: 560 },
  flagCard: { x: 160, y: 480, w: 760, h: 570 },
  reveal: { x: 160, y: 1070, w: 760, h: 180 },
  timer: { x: 340, y: 1300, w: 400, h: 260 },
  dots: { x: 160, y: 1600, w: 760, h: 60 },
};

/** Extra rects for the "options" (A-D) and "list" (1-10) answer styles. All centered, inside the safe zone. */
export const STYLE = {
  options: {
    flagCard: { x: 240, y: 470, w: 600, h: 450 } as Rect,
    bar: { x: 160, y: 950, w: 760, h: 20 } as Rect,
    rows: { x: 160, y: 1000, w: 760, h: 108, gap: 18, count: 4 },
  },
  list: {
    flagCard: { x: 300, y: 440, w: 480, h: 360 } as Rect,
    bar: { x: 160, y: 828, w: 760, h: 20 } as Rect,
    list: { x: 160, y: 868, w: 760, rowH: 79, count: 10 },
  },
} as const;


/** Flag card size per answer style and size. "large" of the open style and "medium" of options / list are the sizes the app always had. */
const CARD: Record<AnswerStyle, Record<FlagSize, [number, number]>> = {
  open: { small: [560, 420], medium: [660, 495], large: [760, 570], xlarge: [760, 570] }, // 760 x 570 is the widest card the safe zone allows (the size of the level-up panel)
  options: { small: [480, 360], medium: [600, 450], large: [700, 525], xlarge: [760, 570] },
  list: { small: [420, 315], medium: [480, 360], large: [600, 450], xlarge: [760, 570] },
};

export interface StyleRects { flagCard: Rect; bar: Rect; rows?: { x: number; y: number; w: number; h: number; gap: number; count: number }; list?: { x: number; y: number; w: number; rowH: number; count: number } }

/** Where everything sits for an answer style at a flag size: the card is centered, the bar and the answers follow it, and everything stays inside the safe zone. */
export function styleRects(style: AnswerStyle, size: FlagSize): StyleRects {
  const [w, h] = CARD[style][size];
  if (style === "open") return { flagCard: { x: 540 - w / 2, y: 480 + (570 - h) / 2, w, h }, bar: { x: 160, y: 1060, w: 760, h: 20 } };
  const y = style === "options" ? 470 : 440, flagCard: Rect = { x: 540 - w / 2, y, w, h }, bottom = y + h;
  if (style === "options") return { flagCard, bar: { x: 160, y: bottom + 30, w: 760, h: 20 }, rows: { x: 160, y: bottom + 80, w: 760, h: 108, gap: 18, count: 4 } };
  const top = bottom + 68, rowH = Math.min(79, Math.floor((H - SAFE.bottom - top) / 10));
  return { flagCard, bar: { x: 160, y: bottom + 28, w: 760, h: 20 }, list: { x: 160, y: top, w: 760, rowH, count: 10 } };
}
