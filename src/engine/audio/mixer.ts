import type { ClipIndex } from "../clipIndex";
import { CLIP_GAP_MS } from "../lines";
import type { Theme, Timeline } from "../types";
import { parseMusicMood, pickTrack } from "./music";
import { chime, heartbeat, musicBed, tick, whoosh } from "./synth";

export const SAMPLE_RATE = 48000;
const DUCK_DB = -8;
const MUSIC_GAIN = 0.55;

export async function loadClips(texts: string[], index: ClipIndex, ctx: BaseAudioContext): Promise<Map<string, AudioBuffer>> {
  const out = new Map<string, AudioBuffer>();
  await Promise.all([...new Set(texts)].map(async (t) => {
    const res = await fetch(index.file(t));
    if (!res.ok) throw new Error(`voice clip "${t}" failed to load (${res.status})`);
    out.set(t, await ctx.decodeAudioData(await res.arrayBuffer()));
  }));
  return out;
}

/** Decodes a bundled music track; null (synth fallback) if it is missing or cannot be decoded. */
async function loadTrack(url: string, ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch { return null; }
}

export function timelineTexts(tl: Timeline): string[] {
  return tl.cues.flatMap((c) => (c.kind === "voice" ? c.clips : []));
}

/** `music`: a track URL, null for no music; absent = the theme's default track. */
export interface MixOptions { muteVoice?: boolean; muteEffects?: boolean; music?: string | null }

/** Voice windows (seconds) where the music is ducked, derived from the cues and clip lengths. */
export function voiceWindows(tl: Timeline, clips: Map<string, AudioBuffer>): [number, number][] {
  return tl.cues.flatMap((c): [number, number][] => {
    if (c.kind !== "voice") return [];
    const sec = c.clips.reduce((a, t) => a + clips.get(t)!.duration, 0) + (CLIP_GAP_MS / 1000) * (c.clips.length - 1);
    return [[c.at, c.at + sec]];
  });
}

export async function mixAudio(tl: Timeline, clips: Map<string, AudioBuffer>, theme: Theme, opts: MixOptions = {}): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(tl.duration * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.08;
  const out = ctx.createGain(); out.gain.value = 0.9;
  master.connect(comp).connect(limiter).connect(out).connect(ctx.destination);

  const musicBus = ctx.createGain();
  musicBus.gain.setValueAtTime(MUSIC_GAIN, 0);
  const duck = Math.pow(10, DUCK_DB / 20);
  for (const [s, e] of voiceWindows(tl, clips)) {
    musicBus.gain.setTargetAtTime(MUSIC_GAIN * duck, s, 0.05);
    musicBus.gain.setTargetAtTime(MUSIC_GAIN, e + 0.1, 0.15);
  }
  musicBus.connect(master);
  const { bpm, family } = parseMusicMood(theme.music.mood);
  const musicUrl = opts.music === undefined ? pickTrack(theme.music.mood) : opts.music;
  const track = musicUrl ? await loadTrack(musicUrl, ctx) : null;
  if (musicUrl === null) { /* music off: voice and effects only */ }
  else if (track) {
    const src = ctx.createBufferSource(); src.buffer = track; src.loop = true;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, 0);
    env.gain.linearRampToValueAtTime(1, 0.4);
    env.gain.setValueAtTime(1, Math.max(0.4, tl.duration - 1.6));
    env.gain.linearRampToValueAtTime(0, tl.duration);
    src.connect(env).connect(musicBus); src.start(0);
  } else musicBed(ctx, musicBus, family, bpm, tl.duration);

  const fx = ctx.createGain(); fx.gain.value = opts.muteEffects ? 0 : 1; fx.connect(master);
  const voice = ctx.createGain(); voice.gain.value = opts.muteVoice ? 0 : 1.2; voice.connect(master);
  const lastTimer = tl.scenes.filter((s) => s.kind === "timer").at(-1);
  for (const c of tl.cues) {
    if (c.kind === "tick") tick(ctx, fx, c.at);
    else if (c.kind === "chime") chime(ctx, fx, c.at);
    else if (c.kind === "whoosh") whoosh(ctx, fx, c.at);
    else if (c.kind === "heartbeat") heartbeat(ctx, fx, c.at, lastTimer?.end ?? c.at + 4);
    else if (c.kind === "voice") {
      let at = c.at;
      for (const text of c.clips) {
        const src = ctx.createBufferSource(); src.buffer = clips.get(text)!;
        src.connect(voice); src.start(at);
        at += src.buffer.duration + CLIP_GAP_MS / 1000;
      }
    }
  }
  return ctx.startRendering();
}
