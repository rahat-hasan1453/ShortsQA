"use client";
import { useEffect, useState } from "react";
import { themes } from "@/data";
import { drawFrame } from "@/engine/render";
import { loadThemeFonts } from "@/engine/render/assets";
import { frameSize } from "@/engine/render/layout";
import type { Theme } from "@/engine/types";
import type { Prepared } from "../prepare";
import { THEME_TAGS, themeTags, type ThemeTag } from "../themeTags";

/** Thumbnail size: a fifth of the frame (216x384 for Shorts, 384x216 for long videos). */
const thumbSize = (p: Prepared) => { const { w, h } = frameSize(p.spec.profile); return { w, h, tw: w / 5, th: h / 5 }; };
/** Thumbnail URLs by quiz identity (theme, seed, type, shape, part, answer style, region); kept for the page's lifetime. */
const cache = new Map<string, string>();

const idle = () => new Promise<void>((r) => ("requestIdleCallback" in window ? requestIdleCallback(() => r()) : setTimeout(r, 16)));

/** One frame of the current quiz drawn in `theme`, one second into the first question. */
async function renderThumb(p: Prepared, theme: Theme): Promise<string> {
  await loadThemeFonts(theme);
  const timer = p.timeline.scenes.find((s) => s.kind === "timer");
  const { w: W, h: H, tw: TW, th: TH } = thumbSize(p);
  const big = new OffscreenCanvas(W, H);
  drawFrame(big.getContext("2d")!, { timeline: p.timeline, theme, assets: p.assets }, (timer?.start ?? 0) + 1.0);
  const small = new OffscreenCanvas(TW, TH);
  const g = small.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(big, 0, 0, TW, TH);
  return URL.createObjectURL(await small.convertToBlob({ type: "image/jpeg", quality: 0.85 }));
}

export default function TemplateGallery({ prepared, value, onChange, disabled }: { prepared: Prepared | null; value: string; onChange: (id: string) => void; disabled: boolean }) {
  const [filter, setFilter] = useState<ThemeTag | "All">("All");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const sp = prepared?.spec;
  const quizKey = sp ? [sp.seed, sp.quiz ?? "flags", sp.profile ?? "short", sp.part, sp.answerStyle, sp.twistRegion ?? ""].join("|") : "";
  const wide = !!prepared && frameSize(prepared.spec.profile).w > frameSize(prepared.spec.profile).h;

  useEffect(() => {
    if (!prepared) return;
    let live = true;
    (async () => {
      setThumbs({}); // a new quiz or shape: never show the previous quiz's thumbnails
      for (const t of themes) { // one at a time, yielding between, so the page stays responsive
        if (!live) return;
        const key = `${t.id}|${quizKey}`;
        if (!cache.has(key)) {
          await idle();
          if (!live) return;
          try { cache.set(key, await renderThumb(prepared, t)); } catch { continue; }
        }
        if (live) setThumbs((m) => ({ ...m, [t.id]: cache.get(key)! }));
      }
    })();
    return () => { live = false; };
  }, [prepared, quizKey]);

  const shown = themes.filter((t) => filter === "All" || themeTags(t).includes(filter));
  const card = (selected: boolean): React.CSSProperties => ({
    display: "grid", gap: 4, padding: 6, borderRadius: 10, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", color: "inherit",
    border: selected ? "2px solid #2563eb" : "1px solid #8884", background: selected ? "rgba(37,99,235,0.13)" : "transparent",
  });

  return (
    <div role="group" aria-label="Template" style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 600 }}>Template <small style={{ fontWeight: 400, color: "#777" }}>colors, background and timer style</small></span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "6px 5px" }}>
        {(["All", ...THEME_TAGS] as const).map((tag) => (
          <button key={tag} type="button" aria-pressed={filter === tag} onClick={() => setFilter(tag)}
            style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #8886", background: filter === tag ? "#2563eb" : "transparent", color: filter === tag ? "#fff" : "inherit", cursor: "pointer", fontSize: 13 }}>{tag}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${wide ? 150 : 100}px, 1fr))`, gap: 8 }}>
        {filter === "All" && (
          <button type="button" data-theme-card="random" aria-pressed={value === "random"} disabled={disabled} onClick={() => onChange("random")} style={card(value === "random")}>
            <div style={{ aspectRatio: wide ? "16 / 9" : "9 / 16", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 32, background: "linear-gradient(135deg,#2563eb33,#db277733)" }}>🎲</div>
            <strong style={{ fontSize: 13 }}>Random</strong>
            <small style={{ color: "#777" }}>recommended</small>
          </button>
        )}
        {shown.map((t) => (
          <button key={t.id} type="button" data-theme-card={t.id} aria-pressed={value === t.id} disabled={disabled} onClick={() => onChange(t.id)} style={card(value === t.id)}>
            {thumbs[t.id]
              // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, not an optimisable asset
              ? <img src={thumbs[t.id]} alt="" style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }} />
              : <div style={{ aspectRatio: wide ? "16 / 9" : "9 / 16", borderRadius: 6, background: `linear-gradient(${t.palette.bgFrom}, ${t.palette.bgTo})` }} />}
            <strong style={{ fontSize: 13 }}>{t.name}</strong>
            <small style={{ color: "#777" }}>{themeTags(t)[0]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
