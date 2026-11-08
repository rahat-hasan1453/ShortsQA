import type { Theme } from "../types";
import type { Ctx } from "./background";
import { LAYOUT } from "./layout";
import { themeFont } from "../theme";

/** progress: 0 at timer start, 1 at timer end. */
export function drawTimer(ctx: Ctx, theme: Theme, progress: number, totalSec: number, t: number): void {
  const r = LAYOUT.timer, p = theme.palette, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
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
