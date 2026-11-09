export const W = 1080;
export const H = 1920;
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
    flagCard: { x: 330, y: 430, w: 420, h: 315 } as Rect,
    bar: { x: 160, y: 775, w: 760, h: 20 } as Rect,
    list: { x: 160, y: 820, w: 760, rowH: 76, count: 10 },
  },
} as const;
