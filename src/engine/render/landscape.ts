import { fitText } from "./text";
import { themeFont } from "../theme";
import type { Scene } from "../types";
import { drawBackground, type Ctx } from "./background";
import {
  BAND_LABEL, drawBigText, drawFactPanel, drawFlagCard, drawHeader, drawOptions, drawPrompt, drawThinBar, haloText, hookText, partTag, roundRect, TIER, wording, type FrameInput,
} from "./index";
import { LONG_H, LONG_W, type Rect } from "./layout";
import { drawConfetti } from "./reveal";

/** 16:9 long-video layout: card on the left; header, A-D options and timer bar on the right; a progress strip along the bottom. */
export const LANDSCAPE = {
  topline: { x: 96, y: 56, w: 1728, h: 60 } as Rect,
  card: { x: 96, y: 180, w: 820, h: 620 } as Rect,
  header: { x: 980, y: 150, w: 844, h: 110 } as Rect,
  rows: { x: 980, y: 300, w: 844, h: 104, gap: 20 },
  bar: { x: 980, y: 800, w: 844, h: 20 } as Rect,
  progress: { x: 96, y: 900, w: 1728, h: 28 } as Rect,
  hook: { x: 260, y: 260, w: 1400, h: 420 } as Rect,
  fact: { x: 980, y: 300, w: 844, h: 476 } as Rect,
};

/** Score tiers shown before the outro, as the highest score in each tier (out of `n`). */
export function scoreTiers(n: number): { label: string; from: number; to: number }[] {
  const b = Math.floor(n * 0.3), s = Math.floor(n * 0.6), e = Math.floor(n * 0.85);
  return [
    { label: "BEGINNER", from: 0, to: b },
    { label: "SMART", from: b + 1, to: s },
    { label: "EXPERT", from: s + 1, to: e },
    { label: "GENIUS", from: e + 1, to: n },
  ];
}

// A function, not a constant: index.ts and this module import each other, so TIER is only ready at call time.
const tierColors = () => [TIER.easy, TIER.medium, TIER.hard, TIER.impossible];

function centerLine(ctx: Ctx, f: FrameInput, text: string, y: number, role: "title" | "body", maxPx: number, color: string, halo = false) {
  const px = fitText((x) => { ctx.font = themeFont(f.theme, role, x); return ctx.measureText(text).width; }, LONG_W - 300, maxPx, 24);
  ctx.font = themeFont(f.theme, role, px); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (halo) haloText(ctx, text, LONG_W / 2, y, color); else { ctx.fillStyle = color; ctx.fillText(text, LONG_W / 2, y); }
}

/** Question strip: one segment per question, tier-coloured, filled once answered. */
function drawProgress(ctx: Ctx, f: FrameInput, current: number, answered: boolean) {
  const r = LANDSCAPE.progress, qs = f.timeline.spec.questions, n = qs.length, gap = 6;
  const w = (r.w - gap * (n - 1)) / n;
  qs.forEach((q, i) => {
    const seg: Rect = { x: r.x + i * (w + gap), y: r.y, w, h: r.h };
    ctx.globalAlpha = i < current || (i === current && answered) ? 1 : i === current ? 0.85 : 0.28;
    roundRect(ctx, seg, Math.min(8, w / 2)); ctx.fillStyle = TIER[q.band].bg; ctx.fill();
    if (i === current) { ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.strokeStyle = f.theme.palette.text; ctx.stroke(); }
  });
  ctx.globalAlpha = 1;
}

function drawTopline(ctx: Ctx, f: FrameInput, q: { index: number }) {
  const r = LANDSCAPE.topline, spec = f.timeline.spec, n = spec.questions.length;
  const text = `EASY TO IMPOSSIBLE${partTag(spec)}`;
  ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = f.theme.palette.text; ctx.textBaseline = "middle";
  ctx.font = themeFont(f.theme, "body", 34); ctx.textAlign = "left"; ctx.fillText(text, r.x, r.y + r.h / 2);
  ctx.font = themeFont(f.theme, "numbers", 40); ctx.textAlign = "right"; ctx.fillText(`${q.index + 1} / ${n}`, r.x + r.w, r.y + r.h / 2);
  ctx.restore();
}

function drawScore(ctx: Ctx, f: FrameInput, k: number) {
  const n = f.timeline.spec.questions.length, tiers = scoreTiers(n);
  drawBigText(ctx, f.theme, ["HOW MANY DID YOU GET?"], { x: 160, y: 150, w: 1600, h: 300 }, 1);
  const w = 360, gap = 40, x0 = (LONG_W - (4 * w + 3 * gap)) / 2;
  tiers.forEach((t, i) => {
    const show = Math.min(1, Math.max(0, k * 5 - i * 0.6)); // pills pop in one after another
    if (show <= 0) return;
    const box: Rect = { x: x0 + i * (w + gap), y: 540 + (1 - show) * 40, w, h: 260 };
    ctx.save(); ctx.globalAlpha = show;
    roundRect(ctx, box, 36); ctx.fillStyle = tierColors()[i].bg; ctx.fill();
    ctx.fillStyle = tierColors()[i].fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = themeFont(f.theme, "numbers", 84); ctx.fillText(`${t.from}–${t.to}`, box.x + w / 2, box.y + 95);
    ctx.font = themeFont(f.theme, "title", 52); ctx.fillText(t.label, box.x + w / 2, box.y + 190);
    ctx.restore();
  });
  centerLine(ctx, f, "TELL US YOUR SCORE IN THE COMMENTS!", 900, "title", 56, "#FFD400", true);
}

function drawHookScene(ctx: Ctx, f: FrameInput, alpha: number) {
  const spec = f.timeline.spec, n = spec.questions.length;
  ctx.save(); ctx.globalAlpha = alpha;
  drawBigText(ctx, f.theme, [hookText(spec, n)], LANDSCAPE.hook, 1);
  ctx.globalAlpha = alpha;
  centerLine(ctx, f, `${n} ${wording(spec.quiz).many}  ·  EASY TO IMPOSSIBLE${partTag(spec)}`, LANDSCAPE.hook.y + LANDSCAPE.hook.h + 70, "body", 52, f.theme.palette.accent);
  ctx.restore();
}

/** One frame of a long (16:9) video at time `t`. */
export function drawLandscapeFrame(ctx: Ctx, f: FrameInput, t: number): void {
  const { timeline, theme } = f, p = theme.palette;
  ctx.save();
  ctx.clearRect(0, 0, LONG_W, LONG_H);
  if (!f.contentOnly) drawBackground(ctx, theme, t, f.assets.background, LONG_W, LONG_H);
  if (f.backgroundOnly) { ctx.restore(); return; }
  const tt = Math.min(Math.max(t, 0), timeline.duration - 1e-6);
  const scene: Scene = timeline.scenes.find((s) => tt >= s.start && tt < s.end) ?? timeline.scenes[timeline.scenes.length - 1];
  const into = tt - scene.start, len = scene.end - scene.start;
  const q = scene.q !== undefined ? timeline.spec.questions[scene.q] : undefined;

  if (scene.kind === "hook") drawHookScene(ctx, f, Math.min(1, 0.2 + into / 0.3));
  else if (scene.kind === "score") drawScore(ctx, f, into / len);
  else if (scene.kind === "outro") {
    drawBigText(ctx, theme, ["THANKS FOR PLAYING!"], { x: 160, y: 220, w: 1600, h: 300 }, 1);
    centerLine(ctx, f, "COMMENT YOUR SCORE!", 640, "title", 80, "#FFD400", true);
    centerLine(ctx, f, timeline.spec.noPart ? "Subscribe for more!" : `Subscribe for part ${timeline.spec.part + 1}`, 760, "body", 56, p.accent);
  } else if (q) {
    const quiz = timeline.spec.quiz, n = timeline.spec.questions.length;
    drawTopline(ctx, f, q);
    if (scene.kind === "diffUp") {
      const k = into / len, tier = TIER[q.band];
      ctx.save(); ctx.translate(0, Math.sin(tt * 70) * 10 * (1 - k));
      drawBigText(ctx, theme, ["LEVEL UP!"], { x: 360, y: 260, w: 1200, h: 240 }, 1);
      const pill: Rect = { x: 660, y: 560, w: 600, h: 170 };
      roundRect(ctx, pill, 48); ctx.fillStyle = tier.bg; ctx.fill();
      ctx.fillStyle = tier.fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = themeFont(theme, "title", 110); ctx.fillText(BAND_LABEL[q.band], pill.x + pill.w / 2, pill.y + pill.h / 2 + 4);
      ctx.restore();
      drawProgress(ctx, f, q.index, false);
    } else {
      const reveal = scene.kind === "reveal";
      drawHeader(ctx, theme, q, `${wording(quiz).one} ${q.index + 1}/${n}`, LANDSCAPE.header);
      if (!reveal) {
        drawFlagCard(ctx, f, q, true, undefined, LANDSCAPE.card, tt, 0.1 + 0.75 * Math.min(1, into / len));
        drawPrompt(ctx, theme, q, LANDSCAPE.card);
        drawOptions(ctx, theme, q, false, LANDSCAPE.rows);
        drawThinBar(ctx, theme, LANDSCAPE.bar, into / len);
        const left = Math.max(0, Math.ceil(len * (1 - into / len)));
        ctx.font = themeFont(theme, "numbers", 44); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = p.text;
        ctx.fillText(String(left), LANDSCAPE.bar.x + LANDSCAPE.bar.w, LANDSCAPE.bar.y + 52);
      } else {
        drawFlagCard(ctx, f, q, true, p.correct, LANDSCAPE.card, tt);
        drawPrompt(ctx, theme, q, LANDSCAPE.card);
        drawOptions(ctx, theme, q, true, LANDSCAPE.rows);
        drawThinBar(ctx, theme, LANDSCAPE.bar, 1);
        drawConfetti(ctx, theme, q.index, into, { x0: 120, x1: 1800, y0: 160, y1: 860 }, 200);
        if (q.fact && scene.factAt !== undefined && tt >= scene.factAt) drawFactPanel(ctx, f, q.fact, "options", Math.min(1, (tt - scene.factAt) / 0.2), LANDSCAPE.fact);
      }
      drawProgress(ctx, f, q.index, reveal);
    }
  }
  ctx.restore();
}
