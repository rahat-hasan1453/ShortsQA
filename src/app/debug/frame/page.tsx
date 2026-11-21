"use client";
import { useEffect, useRef, useState } from "react";
import { countries, flagsVoice, landmarks, pictures, themes, voiceFor, words } from "@/data";
import { LONG_H, LONG_W } from "@/engine/render/layout";
import type { QuizKind } from "@/engine/types";
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
      manifestP ??= fetch("/audio/af_heart/manifest.json").then((r) => r.json());
      const clips = makeClipIndex(await manifestP, "af_heart");
      const theme = themes.find((t) => t.id === themeId)!;
      const spec = buildQuiz({ seed, themeId, answerStyle: style, countries, themes, voice: flagsVoice, clipMs: (t) => clips.ms(t) });
      const timeline = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice: flagsVoice });
      const assets = await loadAssets(theme, spec.questions.flatMap((q) => (q.iso2 ? [q.iso2] : [])), spec.questions.flatMap((q) => (q.iso2 && q.fakeHue ? [{ iso2: q.iso2, hue: q.fakeHue }] : [])));
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
      const clips = makeClipIndex(await manifestP!, "af_heart");
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
      /** Long (16:9) quiz: draws every scene kind content-only; returns how many content pixels fall outside the 1920x1080 frame margin and any error. */
      longScenes: async (quiz: QuizKind, seed: string, themeId = "game-show") => {
        manifestP ??= fetch("/audio/af_heart/manifest.json").then((r) => r.json());
        const clips = makeClipIndex(await manifestP, "af_heart");
        const voice = voiceFor(quiz), theme = themes.find((t) => t.id === themeId)!;
        const spec = buildQuiz({ quiz, seed, themeId, profile: "long", countries, themes, voice, words, landmarks, pictures: pictures.filter((x) => clips.has(x.name)), clipMs: (t) => clips.ms(t) });
        const timeline = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice });
        const assets = await loadAssets(theme, spec.questions.flatMap((q) => (q.iso2 && !q.image ? [q.iso2] : [])), spec.questions.flatMap((q) => (q.iso2 && q.fakeHue ? [{ iso2: q.iso2, hue: q.fakeHue }] : [])), spec.questions.flatMap((q) => (q.image ? [q.image] : [])));
        const out: { kind: string; t: number; outside: number; error?: string }[] = [];
        const factScene = timeline.scenes.find((x) => x.factAt !== undefined);
        const picks = [...["hook", "diffUp", "timer", "reveal", "score", "outro"].map((k) => timeline.scenes.find((x) => x.kind === k)!).filter(Boolean).map((x) => ({ kind: x.kind, t: x.start + Math.min(1, (x.end - x.start) / 2) })),
          ...(factScene ? [{ kind: "fact", t: factScene.factAt! + 0.5 }] : [])];
        for (const { kind, t } of picks) {
          const c = new OffscreenCanvas(LONG_W, LONG_H), g = c.getContext("2d")!;
          try {
            drawFrame(g, { timeline, theme, assets, contentOnly: true }, t);
            const d = g.getImageData(0, 0, LONG_W, LONG_H).data;
            let outside = 0;
            for (let y = 0; y < LONG_H; y++) for (let x = 0; x < LONG_W; x++) if ((x < 32 || x >= LONG_W - 32 || y < 24 || y >= LONG_H - 24) && d[(y * LONG_W + x) * 4 + 3] > 8) outside++;
            out.push({ kind, t, outside });
          } catch (e) { out.push({ kind, t, outside: -1, error: String(e) }); }
        }
        return { n: spec.questions.length, duration: timeline.duration, scenes: out };
      },
      /** A 7-minute long timeline must not be refused by the Shorts 59 s limit: export starts, then is cancelled. */
      longNotRejected: async () => {
        const o = await exportOpts("game-show", "demo");
        const timeline = { ...o.timeline, duration: 420, spec: { ...o.timeline.spec, profile: "long" as const } };
        const ac = new AbortController(); ac.abort();
        try { await exportVideo({ ...o, timeline, signal: ac.signal }); return "no error"; } catch (e) { return errName(e); }
      },
      /** A long export whose save fails must stop with that error, not re-encode the whole video at half bitrate. */
      longSinkFailure: async () => {
        const clips = makeClipIndex(await (manifestP ??= fetch("/audio/af_heart/manifest.json").then((r) => r.json())), "af_heart");
        const theme = themes.find((t) => t.id === "game-show")!;
        const spec = buildQuiz({ seed: "demo", themeId: theme.id, profile: "long", countries, themes, voice: flagsVoice, clipMs: (t) => clips.ms(t) });
        const full = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice: flagsVoice });
        const timeline = { ...full, duration: 3 }; // a few seconds is enough to reach the first save
        const assets = await loadAssets(theme, spec.questions.flatMap((q) => (q.iso2 ? [q.iso2] : [])));
        const audio = new AudioBuffer({ length: 48000 * 3, numberOfChannels: 2, sampleRate: 48000 });
        const o = { timeline, theme, assets, audio };
        let attempts = 0;
        try {
          await exportVideo({ ...o, timeline, sink: async (_d, _p, fresh) => { if (fresh) attempts++; throw new Error("save failed (413)"); } });
          return { error: "none", attempts };
        } catch (e) { return { error: e instanceof Error ? e.message : String(e), attempts }; }
      },
      audioStats: async (themeId: string, seed: string) => {
        const p = await prepare(themeId, seed);
        const clips = makeClipIndex(await manifestP!, "af_heart");
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
