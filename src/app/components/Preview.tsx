"use client";
import { useEffect, useRef, useState } from "react";
import { drawFrame } from "@/engine/render";
import { H, W } from "@/engine/render/layout";
import type { Prepared } from "../prepare";

export default function Preview({ prepared, getAudio }: { prepared: Prepared | null; getAudio: () => Promise<AudioBuffer> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [safe, setSafe] = useState(false);
  const audio = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; startedAt: number; offset: number } | null>(null);

  useEffect(() => {
    if (!prepared || !ref.current) return;
    drawFrame(ref.current.getContext("2d")!, { ...prepared, safeOverlay: safe }, t);
  }, [prepared, t, safe]);

  const stop = () => { audio.current?.src.stop(); audio.current?.ctx.close(); audio.current = null; setPlaying(false); };
  useEffect(() => stop, [prepared]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || !prepared) return;
    let raf = 0;
    const loop = () => {
      const a = audio.current;
      if (!a) return;
      const now = a.offset + (a.ctx.currentTime - a.startedAt);
      if (now >= prepared.timeline.duration) { stop(); setT(0); return; }
      setT(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, prepared]); // eslint-disable-line react-hooks/exhaustive-deps

  async function play() {
    if (!prepared) return;
    const buf = await getAudio();
    const ctx = new AudioContext({ sampleRate: 48000 });
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    const offset = t >= prepared.timeline.duration - 0.05 ? 0 : t;
    src.start(0, offset);
    audio.current = { ctx, src, startedAt: ctx.currentTime, offset };
    setPlaying(true);
  }

  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
      <canvas ref={ref} width={W} height={H} style={{ width: 360, height: 640, background: "#222", borderRadius: 8 }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", width: 360 }}>
        <button type="button" disabled={!prepared} onClick={() => (playing ? stop() : play())}>{playing ? "Pause" : "Play"}</button>
        <input type="range" aria-label="Position" min={0} max={prepared?.timeline.duration ?? 1} step={0.05} value={t} style={{ flex: 1 }}
          onChange={(e) => { if (playing) stop(); setT(Number(e.target.value)); }} />
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> Safe zone</label>
      </div>
    </div>
  );
}
