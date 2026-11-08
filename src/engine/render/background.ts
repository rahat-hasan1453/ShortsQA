import { createRng } from "../rng";
import type { Theme } from "../types";
import { H, W } from "./layout";

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const SPOTS = (() => {
  const r = createRng("bg-spots");
  return Array.from({ length: 28 }, () => ({ x: r.next() * W, y: r.next() * H, r: 40 + r.next() * 140, ph: r.next() * 6.28 }));
})();

/** Background is a pure function of (theme, t). */
export function drawBackground(ctx: Ctx, theme: Theme, t: number): void {
  const p = theme.palette;
  const type = theme.background.type;
  const angle = type === "animated-gradient" ? t * 0.25 : 0.9;
  const dx = Math.cos(angle) * W, dy = Math.sin(angle) * H;
  const g = ctx.createLinearGradient(W / 2 - dx / 2, H / 2 - dy / 2, W / 2 + dx / 2, H / 2 + dy / 2);
  g.addColorStop(0, p.bgFrom);
  g.addColorStop(1, p.bgTo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (type === "pattern") {
    ctx.globalAlpha = 0.18; ctx.fillStyle = p.accent;
    const off = (t * 30) % 120;
    ctx.translate(0, 0);
    for (let x = -H; x < W + H; x += 120) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off + 40, 0); ctx.lineTo(x + off + 40 - H, H); ctx.lineTo(x + off - H, H); ctx.fill(); }
  } else if (type === "grid") {
    ctx.globalAlpha = 0.25; ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
    const off = (t * 20) % 80;
    for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = -80; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y + off); ctx.lineTo(W, y + off); ctx.stroke(); }
  } else if (type === "bokeh" || type === "animated-gradient" || type === "texture") {
    ctx.fillStyle = type === "texture" ? p.text : p.accent2;
    for (const s of SPOTS) {
      ctx.globalAlpha = (type === "texture" ? 0.05 : 0.12) + 0.06 * Math.sin(t * 0.8 + s.ph);
      ctx.beginPath(); ctx.arc(s.x, s.y, type === "texture" ? s.r / 5 : s.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
