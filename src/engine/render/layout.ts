export const W = 1080;
export const H = 1920;
export const SAFE = { top: 200, bottom: 240, right: 160 } as const;

export interface Rect { x: number; y: number; w: number; h: number }

/** All content rects. Content starts at y >= 220; x + w <= 920 (right safe zone). */
export const LAYOUT: Record<"header" | "hook" | "flagCard" | "reveal" | "timer" | "dots", Rect> = {
  header: { x: 40, y: 290, w: 880, h: 130 },
  hook: { x: 40, y: 680, w: 880, h: 560 },
  flagCard: { x: 80, y: 480, w: 800, h: 600 },
  reveal: { x: 40, y: 1100, w: 880, h: 180 },
  timer: { x: 280, y: 1310, w: 400, h: 260 },
  dots: { x: 40, y: 1600, w: 880, h: 60 },
};
