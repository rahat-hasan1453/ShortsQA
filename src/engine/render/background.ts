import { createRng } from "../rng";
import type { Theme } from "../types";
import { H, W } from "./layout";

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const SPOTS = (() => {
  const r = createRng("bg-spots");
  return Array.from({ length: 28 }, () => ({ x: r.next() * W, y: r.next() * H, r: 40 + r.next() * 140, ph: r.next() * 6.28 }));
})();

/** Background is a pure function of (theme, t). */
export function drawBackground(ctx: Ctx, theme: Theme, t: number, image?: ImageBitmap): void {
  const p = theme.palette;
  if (image) {
    // User image (already cover-fitted to 1080x1920) with a light scrim so text stays readable.
    ctx.drawImage(image, 0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = p.bgFrom; ctx.fillRect(0, 0, W, H); ctx.restore();
    return;
  }
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
  } else if (type === "sunburst") {
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#FFFFFF";
    const cx = W / 2, cy = H * 0.45, n = 28, off = t * 0.06;
    for (let i = 0; i < n; i += 2) {
      const a0 = off + (i / n) * Math.PI * 2, a1 = off + ((i + 1) / n) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * 2400, cy + Math.sin(a0) * 2400); ctx.lineTo(cx + Math.cos(a1) * 2400, cy + Math.sin(a1) * 2400); ctx.fill();
    }
  } else if (type === "spotlight") {
    const cx = W / 2, cy = H * 0.42;
    const glow = ctx.createRadialGradient(cx, cy, 60, cx, cy, 1150);
    glow.addColorStop(0, p.accent); glow.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.3 + 0.08 * Math.sin(t * 2.2); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(cx, H / 2, 500, cx, H / 2, 1300);
    vig.addColorStop(0, "transparent"); vig.addColorStop(1, "#000000");
    ctx.globalAlpha = 0.4; ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  } else if (type === "checker") {
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#FFFFFF";
    const size = 120, off = (t * 30) % (size * 2);
    for (let y = -size * 2; y < H + size; y += size) for (let x = -size * 2; x < W + size; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) ctx.fillRect(x + off, y + off, size, size);
    }
  } else if (type === "dots") {
    ctx.globalAlpha = 0.14; ctx.fillStyle = p.accent;
    const gap = 70, off = (t * 8) % gap;
    for (let y = -gap; y < H + gap; y += gap) for (let x = -gap; x < W + gap; x += gap) { ctx.beginPath(); ctx.arc(x + off, y + off, 7, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === "shapes") {
    ctx.globalAlpha = 0.92; ctx.fillStyle = p.accent2;
    ctx.beginPath(); ctx.arc(W * 0.78 + Math.sin(t * 0.3) * 20, H * 0.26, 430, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = p.accent;
    ctx.fillRect(0, H * 0.88, W * 0.55 + Math.sin(t * 0.3) * 20, 64);
  } else if (type === "bokeh" || type === "animated-gradient" || type === "texture") {
    ctx.fillStyle = type === "texture" ? p.text : p.accent2;
    for (const s of SPOTS) {
      ctx.globalAlpha = (type === "texture" ? 0.05 : 0.12) + 0.06 * Math.sin(t * 0.8 + s.ph);
      ctx.beginPath(); ctx.arc(s.x, s.y, type === "texture" ? s.r / 5 : s.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
