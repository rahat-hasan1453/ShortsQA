import { AssetError } from "../errors";
import { createRng } from "../rng";
import { themeFont } from "../theme";
import type { QuizQuestion, Theme, Timeline } from "../types";
import type { Assets } from "./assets";
import { drawBackground, type Ctx } from "./background";
import { H, LAYOUT, SAFE, STYLE, W, type Rect } from "./layout";
import { applyReveal, drawConfetti } from "./reveal";
import { fitText, layoutText, type TextLayout } from "./text";
import { drawTimer } from "./timer";
import { LIKE_BANNER_AT } from "../timeline";

export interface FrameInput {
  timeline: Timeline;
  theme: Theme;
  assets: Assets;
  backgroundOnly?: boolean;
  /** Skip the background so only content pixels (alpha > 0) are drawn; used by the safe-zone test. */
  contentOnly?: boolean;
  safeOverlay?: boolean;
}

/** Tier colors are the same in every theme so viewers learn them (like the big quiz channels). */
const TIER = {
  easy: { bg: "#2ECC71", fg: "#07301a" },
  medium: { bg: "#F5C518", fg: "#3a2c00" },
  hard: { bg: "#FF3B30", fg: "#ffffff" },
  impossible: { bg: "#8E44FF", fg: "#ffffff" },
} as const;

const HOOKS = ["CAN YOU GET 10/10?", "THE LAST ONE IS IMPOSSIBLE", "DON'T SKIP THE LAST ONE!", "EASY TO IMPOSSIBLE. HOW FAR CAN YOU GO?"];
const WORDING: Record<string, { one: string; many: string; list: string }> = {
  flags: { one: "FLAG", many: "FLAGS", list: "GUESS THE FLAG" },
  capitals: { one: "CAPITAL", many: "CAPITALS", list: "NAME THE CAPITAL" },
  math: { one: "PROBLEM", many: "PROBLEMS", list: "SOLVE IT!" },
  "missing-letters": { one: "WORD", many: "WORDS", list: "GUESS THE WORD" },
  landmarks: { one: "LANDMARK", many: "LANDMARKS", list: "WHICH COUNTRY?" },
  "real-vs-fake-flag": { one: "FLAG", many: "FLAGS", list: "REAL OR FAKE?" },
};
const wording = (quiz?: string) => WORDING[quiz ?? "flags"] ?? WORDING.flags;

export const hookText = (spec: { seed: string; twistRegion?: string; quiz?: string }): string =>
  spec.twistRegion ? `${wording(spec.quiz).many} OF ${spec.twistRegion.toUpperCase()}: CAN YOU GET 10/10?` : createRng(`${spec.seed}|hook`).pick(HOOKS);

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

function drawHeader(ctx: Ctx, theme: Theme, q: QuizQuestion, titleOverride?: string) {
  const h = LAYOUT.header, p = theme.palette;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const label = BAND_LABEL[q.band];
  ctx.font = themeFont(theme, "body", 40);
  const bw = ctx.measureText(label).width + 56;
  const title = titleOverride ?? `FLAG ${q.index + 1}/10`;
  // Shrink the title so wide fonts never run into the difficulty badge.
  const px = fitText((x) => { ctx.font = themeFont(theme, "title", x); return ctx.measureText(title).width; }, h.w - bw - 30, 72, 34);
  ctx.font = themeFont(theme, "title", px);
  styledText(ctx, theme, title, h.x, h.y + h.h / 2, p.text, { useFill: true });
  ctx.font = themeFont(theme, "body", 40);
  const badge: Rect = { x: h.x + h.w - bw, y: h.y + 35, w: bw, h: 60 };
  roundRect(ctx, badge, 30); ctx.fillStyle = TIER[q.band].bg; ctx.fill();
  ctx.fillStyle = TIER[q.band].fg; ctx.textAlign = "center"; ctx.fillText(label, badge.x + bw / 2, badge.y + 32);
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

/** Capitals quiz: the country name on a dark band along the bottom of the flag card. */
function drawPrompt(ctx: Ctx, theme: Theme, q: QuizQuestion, c: Rect) {
  if (!q.prompt) return;
  const text = q.prompt.toUpperCase(), h = Math.round(c.h * 0.22);
  const band: Rect = { x: c.x + 24, y: c.y + c.h - 24 - h, w: c.w - 48, h };
  ctx.save();
  roundRect(ctx, { x: c.x + 24, y: c.y + 24, w: c.w - 48, h: c.h - 48 }, 20); ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(band.x, band.y, band.w, band.h);
  const px = fitText((x) => { ctx.font = themeFont(theme, "title", x); return ctx.measureText(text).width; }, band.w - 40, Math.round(h * 0.6), 20);
  ctx.font = themeFont(theme, "title", px); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#FFFFFF";
  ctx.fillText(text, band.x + band.w / 2, band.y + band.h / 2 + 2);
  ctx.restore();
}

function drawFlagCard(ctx: Ctx, f: FrameInput, q: QuizQuestion, showFlag: boolean, borderColor?: string, c: Rect = LAYOUT.flagCard, t = 0) {
  roundRect(ctx, c, 36); ctx.fillStyle = f.theme.palette.card; ctx.fill();
  if (borderColor) { // inset so the 10 px stroke stays inside the card (and the safe zone)
    roundRect(ctx, { x: c.x + 6, y: c.y + 6, w: c.w - 12, h: c.h - 12 }, 30);
    ctx.lineWidth = 10; ctx.strokeStyle = borderColor; ctx.stroke();
  }
  if (!showFlag) return;
  if (q.cardText) { // text-only quizzes: the sum or the masked word instead of a flag
    const text = borderColor && q.cardReveal ? q.cardReveal : q.cardText;
    const px = fitText((x) => { ctx.font = themeFont(f.theme, "title", x); return ctx.measureText(text).width; }, c.w - 90, Math.round(c.h * 0.4), 24);
    ctx.save(); ctx.font = themeFont(f.theme, "title", px); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    haloText(ctx, text, c.x + c.w / 2, c.y + c.h / 2, borderColor ? "#FFD400" : "#FFFFFF", "#000000", Math.max(6, Math.round(px / 9)));
    ctx.restore();
    return;
  }
  if (q.image) { // landmark photo, cover-fitted with a slow zoom
    const photo = f.assets.images.get(q.image);
    if (!photo) throw new AssetError(`landmark photo missing for ${q.image}`);
    const box: Rect = { x: c.x + 24, y: c.y + 24, w: c.w - 48, h: c.h - 48 };
    const k = Math.max(box.w / photo.width, box.h / photo.height) * (1.05 + 0.03 * Math.sin(t * 0.8));
    const w = photo.width * k, h = photo.height * k;
    ctx.save(); roundRect(ctx, box, 20); ctx.clip();
    ctx.drawImage(photo, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    ctx.restore();
    return;
  }
  const img = f.assets.flags.get(q.fakeHue && !borderColor ? `${q.iso2}|fake` : q.iso2 ?? ""); // the reveal (bordered) shows the real flag
  if (!img) throw new AssetError(`flag bitmap missing for ${q.iso2}`);
  const inner: Rect = { x: c.x + 24, y: c.y + 24, w: c.w - 48, h: c.h - 48 };
  ctx.save(); roundRect(ctx, inner, 20); ctx.clip();
  // Waving flag: thin vertical strips shifted by a travelling sine (pure function of t).
  const step = 6, n = Math.ceil(inner.w / step);
  for (let i = 0; i < n; i++) {
    const dy = Math.sin(t * 3 + i * 0.3) * 4;
    ctx.drawImage(img, (img.width * i) / n, 0, img.width / n, img.height, inner.x + i * step, inner.y - 6 + dy, step + 0.6, inner.h + 12);
  }
  ctx.restore();
}

function haloText(ctx: Ctx, text: string, x: number, y: number, fill: string, halo = "#000000", width = 8) {
  ctx.save(); ctx.lineJoin = "round"; ctx.lineWidth = width; ctx.strokeStyle = halo; ctx.strokeText(text, x, y); ctx.restore();
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

function drawThinBar(ctx: Ctx, theme: Theme, r: Rect, progress: number) {
  const p = theme.palette;
  roundRect(ctx, r, r.h / 2); ctx.fillStyle = p.card; ctx.fill();
  const w = Math.max(r.h, r.w * (1 - progress));
  ctx.save(); roundRect(ctx, r, r.h / 2); ctx.clip();
  ctx.fillStyle = (1 - progress) * 3 <= 1 ? p.wrong : p.accent; ctx.fillRect(r.x, r.y, w, r.h);
  ctx.restore();
}

function drawOptions(ctx: Ctx, theme: Theme, q: QuizQuestion, reveal: boolean) {
  const { x, y, w, h, gap } = STYLE.options.rows, p = theme.palette, o = q.options!;
  o.names.forEach((name, i) => {
    const r: Rect = { x, y: y + i * (h + gap), w, h };
    const isRight = i === o.correct;
    ctx.save();
    if (reveal && !isRight) ctx.globalAlpha = 0.4;
    roundRect(ctx, r, 30); ctx.fillStyle = reveal && isRight ? p.correct : p.card; ctx.fill();
    const cr = h / 2 - 14, cx = r.x + 20 + cr + 4, cy = r.y + h / 2;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fillStyle = reveal && isRight ? "#FFFFFF" : p.accent; ctx.fill();
    ctx.textBaseline = "middle"; ctx.textAlign = "center"; ctx.fillStyle = reveal && isRight ? p.correct : "#FFFFFF";
    ctx.font = themeFont(theme, "title", 52); ctx.fillText("ABCD"[i], cx, cy + 2);
    const px = fitText((s) => { ctx.font = themeFont(theme, "body", s); return ctx.measureText(name).width; }, w - 2 * cr - 150, 54, 28);
    ctx.font = themeFont(theme, "body", px); ctx.textAlign = "left"; ctx.fillStyle = reveal && isRight ? "#FFFFFF" : p.text;
    ctx.fillText(name, cx + cr + 24, cy + 2);
    if (reveal && isRight) { ctx.textAlign = "right"; ctx.font = themeFont(theme, "title", 64); ctx.fillText("\u2713", r.x + w - 28, cy + 2); }
    ctx.restore();
  });
}

function drawList(ctx: Ctx, f: FrameInput, q: QuizQuestion, reveal: boolean) {
  const { x, y, rowH, count } = STYLE.list.list, specQs = f.timeline.spec.questions, theme = f.theme;
  ctx.save(); ctx.textBaseline = "middle"; ctx.textAlign = "left";
  for (let i = 0; i < count; i++) {
    const cy = y + i * rowH + rowH / 2, done = i < q.index || (i === q.index && reveal);
    const tier = TIER[specQs[i].band];
    if (i === q.index) { roundRect(ctx, { x, y: y + i * rowH + 3, w: 760, h: rowH - 6 }, 22); ctx.fillStyle = tier.bg; ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1; }
    // Tier-colored number badge: viewers see the easy-to-impossible ladder before it happens.
    const r = rowH / 2 - 8, bx = x + 8 + r;
    ctx.globalAlpha = done || i === q.index ? 1 : 0.55;
    ctx.beginPath(); ctx.arc(bx, cy, r, 0, Math.PI * 2); ctx.fillStyle = tier.bg; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = tier.fg; ctx.textAlign = "center"; ctx.font = themeFont(theme, "numbers", 46);
    ctx.fillText(String(i + 1), bx, cy + 3);
    const label = done ? specQs[i].name : i === count - 1 ? "IMPOSSIBLE" : "";
    if (label) {
      ctx.textAlign = "left";
      const px = fitText((s) => { ctx.font = themeFont(theme, "title", s); return ctx.measureText(label).width; }, 760 - 2 * r - 50, 68, 30);
      ctx.font = themeFont(theme, "title", px);
      haloText(ctx, label, x + 2 * r + 36, cy + 3, done ? "#FFFFFF" : TIER.impossible.bg, "#000000", 9);
    }
  }
  ctx.restore();
}

function drawBigText(ctx: Ctx, theme: Theme, lines: string[], box: Rect, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  const lay = layoutIn(ctx, theme, lines.join(" "), box, 120, 56, true);
  drawLines(ctx, theme, lay.lines.length > 1 || lines.length === 1 ? lay : { ...lay, lines }, box, theme.palette.text, { useFill: true });
  ctx.restore();
}

function drawHook(ctx: Ctx, f: FrameInput, alpha: number, pop = 1) {
  const spec = f.timeline.spec;
  ctx.save(); ctx.globalAlpha = alpha;
  const box = LAYOUT.hook, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  ctx.translate(cx, cy); ctx.scale(pop, pop); ctx.translate(-cx, -cy);
  const lay = layoutIn(ctx, f.theme, hookText(spec), box, 150, 56, true);
  drawLines(ctx, f.theme, lay, box, f.theme.palette.text, { useFill: true });
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = f.theme.palette.accent;
  ctx.font = themeFont(f.theme, "body", 52); ctx.fillText(`10 ${wording(spec.quiz).many}  ·  PART ${spec.part}`, cx, box.y + box.h + 30);
  ctx.restore();
}

/** Persistent series line shown above every question (like "ASIA: EASY TO IMPOSSIBLE #38"). */
function drawTopline(ctx: Ctx, theme: Theme, part: number) {
  const r = LAYOUT.topline, text = `EASY TO IMPOSSIBLE  ·  PART ${part}`;
  const px = fitText((x) => { ctx.font = themeFont(theme, "body", x); return ctx.measureText(text).width; }, r.w - 20, 36, 22);
  ctx.save(); ctx.font = themeFont(theme, "body", px); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = theme.palette.text; ctx.globalAlpha = 0.8;
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
  ctx.restore();
}

function drawLevelUp(ctx: Ctx, f: FrameInput, q: QuizQuestion, k: number, tt: number) {
  const card = LAYOUT.flagCard, tier = TIER[q.band];
  ctx.save();
  ctx.translate(0, Math.sin(tt * 70) * 12 * (1 - k)); // vertical shake that settles (horizontal would leave the safe zone)
  drawFlagCard(ctx, f, q, false);
  drawBigText(ctx, f.theme, ["LEVEL UP!"], { x: card.x, y: card.y + 40, w: card.w, h: 200 }, 1);
  const pill: Rect = { x: card.x + 80, y: card.y + 290, w: card.w - 160, h: 150 };
  roundRect(ctx, pill, 40); ctx.fillStyle = tier.bg; ctx.fill();
  ctx.fillStyle = tier.fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = themeFont(f.theme, "title", 96); ctx.fillText(BAND_LABEL[q.band], pill.x + pill.w / 2, pill.y + pill.h / 2 + 4);
  ctx.save(); roundRect(ctx, card, 36); ctx.clip(); // flash stays inside the card (keeps the safe zone clean)
  ctx.globalAlpha = Math.max(0, 0.6 - k * 1.2); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.restore();
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

  if (scene.kind === "hook") drawHook(ctx, f, 1, 0.85 + 0.15 * Math.min(1, (tt - scene.start) / 0.25));
  else if (scene.kind === "outro") {
    const into = tt - scene.start, len = scene.end - scene.start;
    drawBigText(ctx, theme, ["HOW MANY DID YOU GET?"], LAYOUT.hook, 1);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const fitLine = (text: string, role: "title" | "body", max: number) =>
      fitText((x) => { ctx.font = themeFont(theme, role, x); return ctx.measureText(text).width; }, LAYOUT.hook.w - 80, max, 24);
    const cta = "COMMENT YOUR SCORE!", follow = `Follow for part ${timeline.spec.part + 1}`;
    ctx.font = themeFont(theme, "title", fitLine(cta, "title", 60)); haloText(ctx, cta, LAYOUT.hook.x + LAYOUT.hook.w / 2, LAYOUT.hook.y + LAYOUT.hook.h + 20, "#FFD400");
    ctx.fillStyle = p.accent; ctx.font = themeFont(theme, "body", fitLine(follow, "body", 48));
    ctx.fillText(follow, LAYOUT.hook.x + LAYOUT.hook.w / 2, LAYOUT.hook.y + LAYOUT.hook.h + 100);
    const fade = (into - (len - 0.5)) / 0.5; // loop-friendly: fade into the hook frame
    if (fade > 0) drawHook(ctx, f, Math.min(1, fade));
  } else if (q) {
    drawTopline(ctx, theme, timeline.spec.part);
    const style = timeline.spec.answerStyle;
    drawHeader(ctx, theme, q, style === "list" ? wording(timeline.spec.quiz).list : `${wording(timeline.spec.quiz).one} ${q.index + 1}/10`);
    const card = style === "open" ? LAYOUT.flagCard : STYLE[style].flagCard;
    if (scene.kind === "diffUp") {
      drawLevelUp(ctx, f, q, (tt - scene.start) / (scene.end - scene.start), tt);
      if (q.index === LIKE_BANNER_AT) {
        const box = LAYOUT.reveal;
        roundRect(ctx, { x: box.x, y: box.y + 10, w: box.w, h: box.h - 20 }, 40); ctx.fillStyle = p.accent; ctx.fill();
        const lay = layoutIn(ctx, theme, "LIKE if you got the first 3 right!", { ...box, y: box.y + 10, h: box.h - 20 }, 72, 36, true);
        ctx.font = themeFont(theme, "title", lay.px); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const lh = lay.px * 1.15, y0 = box.y + box.h / 2 - ((lay.lines.length - 1) * lh) / 2;
        lay.lines.forEach((l, i) => haloText(ctx, l, box.x + box.w / 2, y0 + i * lh, "#FFFFFF", "#000000", 8));
      }
    } else if (scene.kind === "timer") {
      drawFlagCard(ctx, f, q, true, undefined, card, tt);
      drawPrompt(ctx, theme, q, card);
      const dur = scene.end - scene.start, prog = (tt - scene.start) / dur;
      if (style === "open") drawTimer(ctx, theme, prog, dur, tt);
      else {
        drawThinBar(ctx, theme, STYLE[style].bar, prog);
        if (style === "options") drawOptions(ctx, theme, q, false); else drawList(ctx, f, q, false);
      }
    } else {
      drawFlagCard(ctx, f, q, true, p.correct, card, tt);
      drawPrompt(ctx, theme, q, card);
      const r = tt - scene.start;
      if (style === "open") {
        ctx.save();
        const box = LAYOUT.reveal;
        const { alpha, clipFrac } = applyReveal(ctx, theme.reveal.style, r, box.x + box.w / 2, box.y + box.h / 2);
        ctx.globalAlpha = alpha;
        if (clipFrac < 1) { ctx.beginPath(); ctx.rect(box.x, box.y, box.w * clipFrac, box.h); ctx.clip(); }
        const lay = layoutIn(ctx, theme, q.name, box, 120, 40);
        drawLines(ctx, theme, lay, box, p.correct, { haloColor: p.bgFrom });
        ctx.restore();
        drawConfetti(ctx, theme, q.index, r);
      } else {
        drawThinBar(ctx, theme, STYLE[style].bar, 1);
        if (style === "options") drawOptions(ctx, theme, q, true); else drawList(ctx, f, q, true);
        drawConfetti(ctx, theme, q.index, r);
      }
    }
    if (style !== "list") drawDots(ctx, theme, q.index, scene.kind === "reveal");
  }
  if (f.safeOverlay) {
    ctx.fillStyle = "rgba(255,0,0,0.25)";
    ctx.fillRect(0, 0, W, SAFE.top); ctx.fillRect(0, H - SAFE.bottom, W, SAFE.bottom); ctx.fillRect(W - SAFE.right, 0, SAFE.right, H);
  }
  ctx.restore();
}
