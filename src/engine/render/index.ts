import { AssetError } from "../errors";
import { themeFont } from "../theme";
import type { QuizQuestion, Theme, Timeline } from "../types";
import type { Assets } from "./assets";
import { drawBackground, type Ctx } from "./background";
import { H, LAYOUT, SAFE, W, type Rect } from "./layout";
import { applyReveal, drawConfetti } from "./reveal";
import { fitText, layoutText, type TextLayout } from "./text";
import { drawTimer } from "./timer";

export interface FrameInput {
  timeline: Timeline;
  theme: Theme;
  assets: Assets;
  backgroundOnly?: boolean;
  /** Skip the background so only content pixels (alpha > 0) are drawn; used by the safe-zone test. */
  contentOnly?: boolean;
  safeOverlay?: boolean;
}

const BAND_LABEL = { easy: "EASY", medium: "MEDIUM", hard: "HARD", impossible: "IMPOSSIBLE" } as const;

function roundRect(ctx: Ctx, r: Rect, rad: number) {
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
}

/** Fits `text` into `box` (up to two lines) using the theme's title font. */
export function layoutIn(ctx: Ctx, theme: Theme, text: string, box: Rect, maxPx: number, minPx: number, preferBigger = false): TextLayout {
  return layoutText(
    (s, px) => { ctx.font = themeFont(theme, "title", px); return ctx.measureText(s).width; },
    text, box.w - 60, maxPx, minPx, preferBigger, // 30 px inset each side: glyphs overhang their measured width
  );
}

/** Filled text, with the theme's outline (titleStyle) when it has one. */
function styledText(ctx: Ctx, theme: Theme, text: string, x: number, y: number, color: string, opts: { useFill?: boolean; haloColor?: string } = {}) {
  const ts = theme.titleStyle;
  if (ts) {
    ctx.save();
    ctx.lineJoin = "round"; ctx.miterLimit = 2;
    ctx.lineWidth = ts.strokeWidth * 1.5;
    ctx.strokeStyle = opts.haloColor ?? ts.stroke;
    ctx.strokeText(text, x, y);
    ctx.restore();
  }
  ctx.fillStyle = ts?.fill && opts.useFill ? ts.fill : color;
  ctx.fillText(text, x, y);
}

function drawLines(ctx: Ctx, theme: Theme, lay: TextLayout, box: Rect, color: string, opts: { useFill?: boolean; haloColor?: string } = {}) {
  ctx.font = themeFont(theme, "title", lay.px);
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const lh = lay.px * 1.15, y0 = box.y + box.h / 2 - ((lay.lines.length - 1) * lh) / 2;
  lay.lines.forEach((l, i) => styledText(ctx, theme, l, box.x + box.w / 2, y0 + i * lh, color, opts));
}

/** Layout of the reveal text for a country name (exported so tests can check it fits the card). */
export function layoutReveal(ctx: Ctx, theme: Theme, name: string): TextLayout {
  return layoutIn(ctx, theme, name, LAYOUT.flagCard, 110, 44);
}

function drawHeader(ctx: Ctx, theme: Theme, q: QuizQuestion) {
  const h = LAYOUT.header, p = theme.palette;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const label = BAND_LABEL[q.band];
  ctx.font = themeFont(theme, "body", 40);
  const bw = ctx.measureText(label).width + 56;
  const title = `FLAG ${q.index + 1}/10`;
  // Shrink the title so wide fonts never run into the difficulty badge.
  const px = fitText((x) => { ctx.font = themeFont(theme, "title", x); return ctx.measureText(title).width; }, h.w - bw - 30, 72, 34);
  ctx.font = themeFont(theme, "title", px);
  styledText(ctx, theme, title, h.x, h.y + h.h / 2, p.text, { useFill: true });
  ctx.font = themeFont(theme, "body", 40);
  const badge: Rect = { x: h.x + h.w - bw, y: h.y + 35, w: bw, h: 60 };
  roundRect(ctx, badge, 30); ctx.fillStyle = q.band === "impossible" ? p.wrong : p.accent2; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(label, badge.x + bw / 2, badge.y + 32);
}

function drawDots(ctx: Ctx, theme: Theme, current: number, done: boolean) {
  const d = LAYOUT.dots, p = theme.palette;
  for (let i = 0; i < 10; i++) {
    const cx = d.x + (d.w / 10) * (i + 0.5), cy = d.y + d.h / 2;
    ctx.beginPath(); ctx.arc(cx, cy, i === current ? 16 : 11, 0, Math.PI * 2);
    ctx.globalAlpha = i > current ? 0.3 : 1;
    ctx.fillStyle = i < current || (i === current && done) ? p.correct : i === current ? p.accent : p.text;
    ctx.fill(); ctx.globalAlpha = 1;
  }
}

function drawFlagCard(ctx: Ctx, f: FrameInput, q: QuizQuestion, showFlag: boolean, borderColor?: string) {
  const c = LAYOUT.flagCard;
  roundRect(ctx, c, 36); ctx.fillStyle = f.theme.palette.card; ctx.fill();
  if (borderColor) { // inset so the 10 px stroke stays inside the card (and the safe zone)
    roundRect(ctx, { x: c.x + 6, y: c.y + 6, w: c.w - 12, h: c.h - 12 }, 30);
    ctx.lineWidth = 10; ctx.strokeStyle = borderColor; ctx.stroke();
  }
  if (!showFlag) return;
  const img = f.assets.flags.get(q.iso2);
  if (!img) throw new AssetError(`flag bitmap missing for ${q.iso2}`);
  ctx.save(); roundRect(ctx, { x: c.x + 24, y: c.y + 24, w: c.w - 48, h: c.h - 48 }, 20); ctx.clip();
  ctx.drawImage(img, c.x + 24, c.y + 24, c.w - 48, c.h - 48);
  ctx.restore();
}

function drawBigText(ctx: Ctx, theme: Theme, lines: string[], box: Rect, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  const lay = layoutIn(ctx, theme, lines.join(" "), box, 120, 56, true);
  drawLines(ctx, theme, lay.lines.length > 1 || lines.length === 1 ? lay : { ...lay, lines }, box, theme.palette.text, { useFill: true });
  ctx.restore();
}

function drawHook(ctx: Ctx, f: FrameInput, alpha: number) {
  const spec = f.timeline.spec;
  const title = spec.twistRegion ? `Can you name these ${spec.twistRegion} flags?` : "Can you name all 10 flags?";
  drawBigText(ctx, f.theme, [title], LAYOUT.hook, alpha);
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = "center"; ctx.fillStyle = f.theme.palette.accent;
  ctx.font = themeFont(f.theme, "body", 56); ctx.fillText(`Part ${spec.part}`, LAYOUT.hook.x + LAYOUT.hook.w / 2, LAYOUT.hook.y + LAYOUT.hook.h + 20);
  ctx.restore();
}

export const renderStats = { frames: 0 };

export function drawFrame(ctx: Ctx, f: FrameInput, t: number): void {
  renderStats.frames++;
  const { timeline, theme } = f;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (!f.contentOnly) drawBackground(ctx, theme, t, f.assets.background);
  if (f.backgroundOnly) { ctx.restore(); return; }
  const tt = Math.min(Math.max(t, 0), timeline.duration - 1e-6);
  const scene = timeline.scenes.find((s) => tt >= s.start && tt < s.end) ?? timeline.scenes[timeline.scenes.length - 1];
  const q = scene.q !== undefined ? timeline.spec.questions[scene.q] : undefined;
  const p = theme.palette;

  if (scene.kind === "hook") drawHook(ctx, f, Math.min(1, (tt - scene.start) / 0.3 + 0.2));
  else if (scene.kind === "outro") {
    const into = tt - scene.start, len = scene.end - scene.start;
    drawBigText(ctx, theme, ["Comment your score!"], LAYOUT.hook, 1);
    ctx.textAlign = "center"; ctx.fillStyle = p.accent; ctx.font = themeFont(theme, "body", 56);
    ctx.fillText(`Follow for part ${timeline.spec.part + 1}`, LAYOUT.hook.x + LAYOUT.hook.w / 2, LAYOUT.hook.y + LAYOUT.hook.h + 20);
    const fade = (into - (len - 0.5)) / 0.5; // loop-friendly: fade into the hook frame
    if (fade > 0) drawHook(ctx, f, Math.min(1, fade));
  } else if (q) {
    drawHeader(ctx, theme, q);
    if (scene.kind === "diffUp") {
      drawFlagCard(ctx, f, q, false);
      drawBigText(ctx, theme, [`${BAND_LABEL[q.band]} LEVEL`], LAYOUT.flagCard, Math.min(1, (tt - scene.start) / 0.2));
    } else if (scene.kind === "timer") {
      drawFlagCard(ctx, f, q, true);
      const dur = scene.end - scene.start;
      drawTimer(ctx, theme, (tt - scene.start) / dur, dur, tt);
    } else {
      drawFlagCard(ctx, f, q, true, p.correct);
      const r = tt - scene.start;
      ctx.save();
      const box = LAYOUT.reveal;
      const { alpha, clipFrac } = applyReveal(ctx, theme.reveal.style, r, box.x + box.w / 2, box.y + box.h / 2);
      ctx.globalAlpha = alpha;
      if (clipFrac < 1) { ctx.beginPath(); ctx.rect(box.x, box.y, box.w * clipFrac, box.h); ctx.clip(); }
      const lay = layoutIn(ctx, theme, q.name, box, 120, 40);
      drawLines(ctx, theme, lay, box, p.correct, { haloColor: p.bgFrom });
      ctx.restore();
      drawConfetti(ctx, theme, q.index, r);
    }
    drawDots(ctx, theme, q.index, scene.kind === "reveal");
  }
  if (f.safeOverlay) {
    ctx.fillStyle = "rgba(255,0,0,0.25)";
    ctx.fillRect(0, 0, W, SAFE.top); ctx.fillRect(0, H - SAFE.bottom, W, SAFE.bottom); ctx.fillRect(W - SAFE.right, 0, SAFE.right, H);
  }
  ctx.restore();
}
