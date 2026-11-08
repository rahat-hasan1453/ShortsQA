import { createRng } from "../rng";
import type { Theme } from "../types";
import type { Ctx } from "./background";
import { LAYOUT } from "./layout";

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** r: seconds since the reveal started. Applies the theme's reveal style around the reveal text. */
export function applyReveal(ctx: Ctx, style: string, r: number, cx: number, cy: number): { alpha: number; clipFrac: number } {
  const k = ease(r / 0.45);
  let alpha = 1, clipFrac = 1;
  ctx.translate(cx, cy);
  if (style === "pop") { const s = 0.5 + 0.5 * (k + 0.15 * Math.sin(k * Math.PI)); ctx.scale(s, s); alpha = k; }
  else if (style === "slide") { ctx.translate(0, 70 * (1 - k)); alpha = k; }
  else if (style === "shake") { ctx.translate(Math.sin(r * 60) * 14 * (1 - k), 0); alpha = Math.min(1, k * 2); }
  else if (style === "flip") { ctx.scale(Math.max(0.02, Math.abs(Math.cos((1 - k) * Math.PI / 2))), 1); alpha = k; }
  else if (style === "wipe") { clipFrac = k; }
  else if (style === "confetti") { const s = 0.7 + 0.3 * k; ctx.scale(s, s); alpha = k; }
  ctx.translate(-cx, -cy);
  return { alpha, clipFrac };
}

export function drawConfetti(ctx: Ctx, theme: Theme, q: number, r: number): void {
  if (theme.reveal.style !== "confetti" || r > 1.4) return;
  const rng = createRng(`confetti-${q}`);
  const box = { x0: 170, x1: 900, y0: 480, y1: 1260 };
  const colors = [theme.palette.accent, theme.palette.accent2, theme.palette.correct];
  ctx.save();
  for (let i = 0; i < 42; i++) {
    const x = box.x0 + rng.next() * (box.x1 - box.x0), vy = 200 + rng.next() * 300, y0 = LAYOUT.reveal.y + rng.next() * 40;
    const y = Math.min(box.y1 - 10, y0 - 120 + vy * r * (0.4 + 0.6 * r));
    ctx.globalAlpha = Math.max(0, 1 - r / 1.4);
    ctx.fillStyle = colors[i % 3];
    ctx.fillRect(x, Math.max(box.y0, y), 14, 22);
  }
  ctx.restore();
}
