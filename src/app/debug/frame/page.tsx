"use client";
import { useEffect, useRef, useState } from "react";
import { countries, flagsVoice, themes } from "@/data";
import { makeClipIndex, type Manifest } from "@/engine/clipIndex";
import { buildQuiz } from "@/engine/quizBuilder";
import { buildTimeline } from "@/engine/timeline";
import { loadAssets, type Assets } from "@/engine/render/assets";
import { drawFrame, layoutReveal, renderStats } from "@/engine/render";
import { exportVideo } from "@/engine/export/encoder";
import { AssetError, ExportBusyError } from "@/engine/errors";
import { DurationError } from "@/engine/timeline";
import { H, SAFE, W } from "@/engine/render/layout";
import type { Timeline } from "@/engine/types";
import { loadClips, mixAudio, timelineTexts, voiceWindows } from "@/engine/audio/mixer";

type Prepared = { timeline: Timeline; assets: Assets; theme: (typeof themes)[number] };

function resolveAt(tl: Timeline, at: string): number {
  const [kind, a, b] = at.split(":");
  const num = Number(kind);
  if (!Number.isNaN(num) && at.indexOf(":") < 0) return num;
  const q = b !== undefined ? Number(a) : undefined;
  const off = Number(b ?? a ?? 0);
  const s = tl.scenes.find((x) => x.kind === kind && (q === undefined || x.q === q))!;
  return s.start + off;
}

export default function DebugFrame() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    let manifestP: Promise<Manifest> | null = null;
    const cache = new Map<string, Prepared>();
    const prepare = async (themeId: string, seed: string, style: "open" | "options" | "list" = "open"): Promise<Prepared> => {
      const key = `${themeId}|${seed}|${style}`;
      if (cache.has(key)) return cache.get(key)!;
      manifestP ??= fetch("/audio/manifest.json").then((r) => r.json());
      const clips = makeClipIndex(await manifestP);
      const theme = themes.find((t) => t.id === themeId)!;
      const spec = buildQuiz({ seed, themeId, answerStyle: style, countries, themes, voice: flagsVoice, clipMs: (t) => clips.ms(t) });
      const timeline = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice: flagsVoice });
      const assets = await loadAssets(theme, spec.questions.map((q) => q.iso2));
      const p = { timeline, assets, theme };
      cache.set(key, p);
      return p;
    };
    const render = async (canvas: HTMLCanvasElement | OffscreenCanvas, themeId: string, seed: string, at: string, opts: { backgroundOnly?: boolean; contentOnly?: boolean; safeOverlay?: boolean } = {}, style: "open" | "options" | "list" = "open") => {
      const p = await prepare(themeId, seed, style);
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      drawFrame(ctx, { ...p, ...opts }, resolveAt(p.timeline, at));
      return p;
    };
    const errName = (e: unknown) =>
      e instanceof DurationError ? "DurationError" : e instanceof AssetError ? "AssetError" : e instanceof ExportBusyError ? "ExportBusyError" : e instanceof Error ? e.name : "unknown";
    const b64 = async (blob: Blob) => {
      const u = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const exportOpts = async (themeId: string, seed: string) => {
      const p = await prepare(themeId, seed);
      const clips = makeClipIndex(await manifestP!);
      const buffers = await loadClips(timelineTexts(p.timeline), clips, new OfflineAudioContext(1, 48000, 48000));
      const audio = await mixAudio(p.timeline, buffers, p.theme);
      return { timeline: p.timeline, theme: p.theme, assets: p.assets, audio };
    };
    (window as any).__debug = {
      themes: themes.map((t) => t.id),
      names: countries.map((c) => c.name),
      render: (themeId: string, seed: string, at: string, style: "open" | "options" | "list" = "open") => render(ref.current!, themeId, seed, at, {}, style).then((p) => p.assets.warnings),
      marginDiff: async (themeId: string, seed: string, at: string, style: "open" | "options" | "list" = "open") => {
        // Draw content only on a transparent canvas: any non-transparent pixel in the margins is content in the safe zone.
        const a = new OffscreenCanvas(W, H);
        await render(a, themeId, seed, at, { contentOnly: true }, style);
        const d = a.getContext("2d")!.getImageData(0, 0, W, H).data;
        let diff = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (y >= SAFE.top && y < H - SAFE.bottom && x < W - SAFE.right) continue;
          if (d[(y * W + x) * 4 + 3] > 8) { diff++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        }
        (window as any).__diffBox = { x0, x1, y0, y1 };
        return diff;
      },
      revealLayout: async (themeId: string, name: string) => {
        const theme = themes.find((t) => t.id === themeId)!;
        await loadAssets(theme, []);
        const ctx = new OffscreenCanvas(10, 10).getContext("2d")!;
        return layoutReveal(ctx, theme, name);
      },
      dataUrl: () => ref.current!.toDataURL(),
      exportConcurrent: async (themeId: string, seed: string) => {
        const o = await exportOpts(themeId, seed);
        const first = exportVideo(o);
        let secondError = "none";
        try { await exportVideo(o); } catch (e) { secondError = errName(e); }
        return { secondError, firstBase64: await b64(await first) };
      },
      exportAbortThenRetry: async (themeId: string, seed: string) => {
        const o = await exportOpts(themeId, seed);
        const ac = new AbortController();
        const pending = exportVideo({ ...o, signal: ac.signal });
        setTimeout(() => ac.abort(), 700);
        let abortError = "none";
        try { await pending; } catch (e) { abortError = errName(e); }
        const blob = await exportVideo(o);
        return { abortError, retryBytes: blob.size };
      },
      exportBad: async (themeId: string, seed: string, kind: string) => {
        const o = await exportOpts(themeId, seed);
        renderStats.frames = 0;
        const bad = kind === "duration"
          ? { ...o, timeline: { ...o.timeline, duration: 61 } }
          : { ...o, assets: { ...o.assets, flags: new Map([...o.assets.flags].slice(1)) } };
        let error = "none";
        try { await exportVideo(bad); } catch (e) { error = errName(e); }
        return { error, framesDrawn: renderStats.frames };
      },
      audioStats: async (themeId: string, seed: string) => {
        const p = await prepare(themeId, seed);
        const clips = makeClipIndex(await manifestP!);
        const buffers = await loadClips(timelineTexts(p.timeline), clips, new OfflineAudioContext(1, 48000, 48000));
        const full = await mixAudio(p.timeline, buffers, p.theme);
        const noVoice = await mixAudio(p.timeline, buffers, p.theme, { muteVoice: true });
        const bed = await mixAudio(p.timeline, buffers, p.theme, { muteVoice: true, muteEffects: true });
        const wins = voiceWindows(p.timeline, buffers);
        const rms = (b: AudioBuffer, s: number, e: number) => {
          const d = b.getChannelData(0), i0 = Math.floor(s * b.sampleRate), i1 = Math.min(d.length, Math.floor(e * b.sampleRate));
          let acc = 0; for (let i = i0; i < i1; i++) acc += d[i] * d[i];
          return Math.sqrt(acc / Math.max(1, i1 - i0));
        };
        let peak = 0, nan = false;
        for (let ch = 0; ch < 2; ch++) for (const v of full.getChannelData(ch)) { if (Number.isNaN(v)) nan = true; peak = Math.max(peak, Math.abs(v)); }
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        // music-only RMS inside voice windows vs in 1 s gaps with no voice
        const inside = mean(wins.map(([s, e]) => rms(bed, s + 0.1, e)));
        const gaps: number[] = [];
        for (let t = 0; t + 1 < p.timeline.duration; t += 1) if (!wins.some(([s, e]) => t < e + 0.4 && t + 1 > s - 0.1)) gaps.push(rms(bed, t, t + 1));
        return {
          length: full.length, duration: p.timeline.duration, rate: full.sampleRate, channels: full.numberOfChannels, peak, nan,
          voiceFull: mean(wins.map(([s, e]) => rms(full, s, e))), voiceMuted: mean(wins.map(([s, e]) => rms(noVoice, s, e))),
          duckRatio: inside / mean(gaps), gapCount: gaps.length,
        };
      },
    };
    const themeId = params.get("theme") ?? "arctic-ice", seed = params.get("seed") ?? "demo", at = params.get("at");
    (async () => {
      if (at) {
        const w = await (window as any).__debug.render(themeId, seed, at);
        setWarnings(w);
      }
      setReady(true);
    })();
  }, []);

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ background: "#222" }}>
      <canvas ref={ref} width={W} height={H} style={{ width: 360, height: 640, display: "block" }} />
      <div data-testid="warnings">{warnings.join(" | ")}</div>
      <div data-testid="ready">{ready ? "ready" : "loading"}</div>
    </div>
  );
}
