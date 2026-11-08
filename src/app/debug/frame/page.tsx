"use client";
import { useEffect, useRef, useState } from "react";
import { countries, flagsVoice, themes } from "@/data";
import { makeClipIndex, type Manifest } from "@/engine/clipIndex";
import { buildQuiz } from "@/engine/quizBuilder";
import { buildTimeline } from "@/engine/timeline";
import { loadAssets, type Assets } from "@/engine/render/assets";
import { drawFrame, layoutReveal } from "@/engine/render";
import { H, SAFE, W } from "@/engine/render/layout";
import type { Timeline } from "@/engine/types";

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
    const prepare = async (themeId: string, seed: string): Promise<Prepared> => {
      const key = `${themeId}|${seed}`;
      if (cache.has(key)) return cache.get(key)!;
      manifestP ??= fetch("/audio/manifest.json").then((r) => r.json());
      const clips = makeClipIndex(await manifestP);
      const theme = themes.find((t) => t.id === themeId)!;
      const spec = buildQuiz({ seed, themeId, countries, themes, voice: flagsVoice, clipMs: (t) => clips.ms(t) });
      const timeline = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice: flagsVoice });
      const assets = await loadAssets(theme, spec.questions.map((q) => q.iso2));
      const p = { timeline, assets, theme };
      cache.set(key, p);
      return p;
    };
    const render = async (canvas: HTMLCanvasElement | OffscreenCanvas, themeId: string, seed: string, at: string, opts: { backgroundOnly?: boolean; safeOverlay?: boolean } = {}) => {
      const p = await prepare(themeId, seed);
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      drawFrame(ctx, { ...p, ...opts }, resolveAt(p.timeline, at));
      return p;
    };
    (window as any).__debug = {
      themes: themes.map((t) => t.id),
      names: countries.map((c) => c.name),
      render: (themeId: string, seed: string, at: string) => render(ref.current!, themeId, seed, at).then((p) => p.assets.warnings),
      marginDiff: async (themeId: string, seed: string, at: string) => {
        const a = new OffscreenCanvas(W, H), b = new OffscreenCanvas(W, H);
        await render(a, themeId, seed, at); await render(b, themeId, seed, at, { backgroundOnly: true });
        const da = a.getContext("2d")!.getImageData(0, 0, W, H).data, db = b.getContext("2d")!.getImageData(0, 0, W, H).data;
        let diff = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (y >= SAFE.top && y < H - SAFE.bottom && x < W - SAFE.right) continue;
          const i = (y * W + x) * 4;
          if (Math.abs(da[i] - db[i]) > 3 || Math.abs(da[i + 1] - db[i + 1]) > 3 || Math.abs(da[i + 2] - db[i + 2]) > 3) { diff++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
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
