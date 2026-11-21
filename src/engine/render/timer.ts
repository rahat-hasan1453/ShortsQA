import type { Theme } from "../types";
import type { Ctx } from "./background";
import { LAYOUT } from "./layout";
import { themeFont } from "../theme";

/** progress: 0 at timer start, 1 at timer end. */
export function drawTimer(ctx: Ctx, theme: Theme, progress: number, totalSec: number, t: number, box = LAYOUT.timer): void {
  const r = box, p = theme.palette, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const left = Math.max(0, Math.ceil(totalSec * (1 - progress)));
  const style = theme.timer.style;
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 26; ctx.lineCap = "round";
  const urgent = totalSec * (1 - progress) <= 1;
  const color = urgent ? p.wrong : p.accent;
  if (style === "bar") {
    ctx.fillStyle = p.card; ctx.fillRect(r.x, cy - 30, r.w, 60);
    ctx.fillStyle = color; ctx.fillRect(r.x, cy - 30, r.w * (1 - progress), 60);
    ctx.fillStyle = p.text; ctx.font = themeFont(theme, "numbers", 90); ctx.fillText(String(left), cx, cy + 90);
  } else if (style === "hourglass") {
    ctx.fillStyle = p.card; ctx.beginPath(); ctx.moveTo(cx - 80, cy - 110); ctx.lineTo(cx + 80, cy - 110); ctx.lineTo(cx, cy); ctx.lineTo(cx + 80, cy + 110); ctx.lineTo(cx - 80, cy + 110); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color; const top = 110 * (1 - progress);
    ctx.beginPath(); ctx.moveTo(cx - 80 * (top / 110), cy - top); ctx.lineTo(cx + 80 * (top / 110), cy - top); ctx.lineTo(cx, cy); ctx.fill();
    ctx.fillRect(cx - 40 * progress, cy + 110 - 110 * progress, 80 * progress, 110 * progress);
  } else if (style === "pie") {
    const rad = 120;
    ctx.fillStyle = p.card; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = p.card; ctx.beginPath(); ctx.arc(cx, cy, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.text; ctx.font = themeFont(theme, "numbers", 84); ctx.fillText(String(left), cx, cy + 4);
  } else if (style === "dial") {
    const rad = 118;
    ctx.fillStyle = p.card; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 12; ctx.strokeStyle = p.accent; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 6;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (rad - 24), cy + Math.sin(a) * (rad - 24)); ctx.lineTo(cx + Math.cos(a) * (rad - 8), cy + Math.sin(a) * (rad - 8)); ctx.stroke(); }
    const ang = -Math.PI / 2 + Math.PI * 2 * progress;
    ctx.strokeStyle = urgent ? p.wrong : p.accent2; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * (rad - 28), cy + Math.sin(ang) * (rad - 28)); ctx.stroke();
    ctx.fillStyle = p.text; ctx.font = themeFont(theme, "numbers", 70); ctx.fillText(String(left), cx, cy + rad + 40);
  } else if (style === "big-number") {
    const pulse = urgent || totalSec * (1 - progress) <= 3 ? 1 + 0.1 * Math.sin(t * 14) : 1;
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 40;
    ctx.font = themeFont(theme, "numbers", Math.round(250 * pulse)); ctx.fillText(String(left), cx, cy);
  } else if (style === "numeric" || style === "flip") {
    ctx.fillStyle = style === "flip" ? p.card : "transparent"; if (style === "flip") ctx.fillRect(cx - 90, cy - 110, 180, 220);
    ctx.fillStyle = color; ctx.font = themeFont(theme, "numbers", 200); ctx.fillText(String(left), cx, cy);
  } else {
    const rad = 110 * (style === "pulse" ? 1 + 0.06 * Math.sin(t * 8) : 1);
    ctx.strokeStyle = p.card; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress)); ctx.stroke();
    ctx.fillStyle = p.text; ctx.font = themeFont(theme, "numbers", 110); ctx.fillText(String(left), cx, cy + 4);
  }
  ctx.restore();
}
