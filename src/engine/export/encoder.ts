import { ArrayBufferTarget, Muxer, StreamTarget } from "mp4-muxer";
import { AssetError, ExportBusyError } from "../errors";
import { drawFrame } from "../render";
import type { Assets } from "../render/assets";
import { frameSize } from "../render/layout";
import { DurationError, maxDuration } from "../timeline";
import type { Theme, Timeline } from "../types";

export { AssetError, ExportBusyError };

export interface ExportOptions {
  timeline: Timeline;
  theme: Theme;
  assets: Assets;
  audio: AudioBuffer;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
  /** Stream the MP4 out as it is made (long videos): called with each chunk and its byte position; nothing is kept in memory. */
  sink?: (data: Uint8Array, position: number, fresh: boolean) => Promise<void>;
}

export const FPS = 30;
/** Bytes per streamed chunk: the Next proxy silently cuts request bodies above 10 MB, so stay far below it. */
export const STREAM_CHUNK = 4 * 1024 * 1024;
let busy = false;

const abortError = () => new DOMException("Export aborted", "AbortError");
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function validate(o: ExportOptions) {
  const max = maxDuration(o.timeline.spec.profile);
  if (o.timeline.duration > max) throw new DurationError(`timeline is ${o.timeline.duration.toFixed(1)}s, max ${max}s`);
  for (const q of o.timeline.spec.questions) if (q.iso2 && !o.assets.flags.has(q.iso2)) throw new AssetError(`flag bitmap missing for ${q.iso2}`);
}

/** Resolves to the MP4 as a Blob, or to null when `o.sink` received it. */
export async function exportVideo(o: ExportOptions & { sink: NonNullable<ExportOptions["sink"]> }): Promise<null>;
export async function exportVideo(o: ExportOptions): Promise<Blob>;
export async function exportVideo(o: ExportOptions): Promise<Blob | null> {
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

async function run(o: ExportOptions, bitrateScale: number): Promise<Blob | null> {
  const { timeline, theme, assets, audio, signal } = o;
  const { w: W, h: H } = frameSize(timeline.spec.profile);
  const frames = Math.ceil(timeline.duration * FPS);
  // Streamed exports write chunks as they come (moov at the end); in-memory ones keep fast start for instant playback.
  const writes: Promise<void>[] = [];
  let sinkError: unknown = null, fresh = true; // fresh: the first chunk of this attempt (a retry must not append to a failed file)
  const target = o.sink
    ? new StreamTarget({ chunked: true, chunkSize: STREAM_CHUNK, onData: (data, position) => { writes.push(o.sink!(data.slice(), position, fresh).catch((e) => { sinkError = e; })); fresh = false; } })
    : new ArrayBufferTarget();
  const flushWrites = async () => { await Promise.all(writes.splice(0)); if (sinkError) throw sinkError; };
  const muxer = new Muxer({
    target, fastStart: o.sink ? false : "in-memory",
    video: { codec: "avc", width: W, height: H, frameRate: FPS },
    audio: { codec: "aac", numberOfChannels: 2, sampleRate: audio.sampleRate },
  });
  let failure: Error | null = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { failure = e; } });
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { failure = e; } });
  try {
    venc.configure({ codec: "avc1.640028", width: W, height: H, bitrate: (timeline.spec.profile === "long" ? 8_000_000 : 6_000_000) * bitrateScale, framerate: FPS, avc: { format: "avc" } });
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
      if (o.sink && writes.length > 8) await flushWrites(); // keep at most a few chunks in flight
    }
    await venc.flush();
    await aenc.flush();
    if (failure) throw failure;
    muxer.finalize();
    if (o.sink) { await flushWrites(); o.onProgress?.(1); return null; }
    o.onProgress?.(1);
    return new Blob([(target as ArrayBufferTarget).buffer], { type: "video/mp4" });
  } finally {
    if (venc.state !== "closed") venc.close();
    if (aenc.state !== "closed") aenc.close();
  }
}
