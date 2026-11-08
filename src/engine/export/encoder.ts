import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { AssetError, ExportBusyError } from "../errors";
import { drawFrame } from "../render";
import type { Assets } from "../render/assets";
import { H, W } from "../render/layout";
import { DurationError, MAX_DURATION } from "../timeline";
import type { Theme, Timeline } from "../types";

export { AssetError, ExportBusyError };

export interface ExportOptions {
  timeline: Timeline;
  theme: Theme;
  assets: Assets;
  audio: AudioBuffer;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export const FPS = 30;
let busy = false;

const abortError = () => new DOMException("Export aborted", "AbortError");
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function validate(o: ExportOptions) {
  if (o.timeline.duration > MAX_DURATION) throw new DurationError(`timeline is ${o.timeline.duration.toFixed(1)}s, max ${MAX_DURATION}s`);
  for (const q of o.timeline.spec.questions) if (!o.assets.flags.has(q.iso2)) throw new AssetError(`flag bitmap missing for ${q.iso2}`);
}

export async function exportVideo(o: ExportOptions): Promise<Blob> {
  if (busy) throw new ExportBusyError("an export is already running");
  validate(o);
  busy = true;
  try {
    try {
      return await run(o, 1);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      if (e instanceof AssetError || e instanceof DurationError) throw e;
      try {
        return await run(o, 0.5);
      } catch (e2) {
        if (e2 instanceof DOMException && e2.name === "AbortError") throw e2;
        throw new Error(`export failed (seed ${o.timeline.spec.seed}): ${e2 instanceof Error ? e2.message : String(e2)}`);
      }
    }
  } finally {
    busy = false;
  }
}

async function run(o: ExportOptions, bitrateScale: number): Promise<Blob> {
  const { timeline, theme, assets, audio, signal } = o;
  const frames = Math.ceil(timeline.duration * FPS);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: "in-memory",
    video: { codec: "avc", width: W, height: H, frameRate: FPS },
    audio: { codec: "aac", numberOfChannels: 2, sampleRate: audio.sampleRate },
  });
  let failure: Error | null = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { failure = e; } });
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { failure = e; } });
  try {
    venc.configure({ codec: "avc1.640028", width: W, height: H, bitrate: 6_000_000 * bitrateScale, framerate: FPS, avc: { format: "avc" } });
    aenc.configure({ codec: "mp4a.40.2", sampleRate: audio.sampleRate, numberOfChannels: 2, bitrate: 128000 });

    const ch = [audio.getChannelData(0), audio.getChannelData(Math.min(1, audio.numberOfChannels - 1))];
    const step = audio.sampleRate; // 1 s per AudioData
    for (let i = 0; i < audio.length; i += step) {
      const n = Math.min(step, audio.length - i);
      const buf = new Float32Array(n * 2);
      buf.set(ch[0].subarray(i, i + n), 0);
      buf.set(ch[1].subarray(i, i + n), n);
      aenc.encode(new AudioData({ format: "f32-planar", sampleRate: audio.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / audio.sampleRate) * 1e6), data: buf }));
    }

    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw abortError();
      if (failure) throw failure;
      drawFrame(ctx, { timeline, theme, assets }, i / FPS);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: i % 60 === 0 });
      frame.close();
      while (venc.encodeQueueSize > 6) await tick();
      if (i % 15 === 0) { o.onProgress?.(i / frames); await tick(); }
    }
    await venc.flush();
    await aenc.flush();
    if (failure) throw failure;
    muxer.finalize();
    o.onProgress?.(1);
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    if (venc.state !== "closed") venc.close();
    if (aenc.state !== "closed") aenc.close();
  }
}
