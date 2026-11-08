import type { MusicFamily } from "./music";

type C = BaseAudioContext;
const hz = (semi: number) => 440 * Math.pow(2, (semi - 9) / 12); // semitones above C4... semi 9 = A4

function tone(ctx: C, dest: AudioNode, type: OscillatorType, f: number, at: number, dur: number, gain: number, lp = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node: AudioNode = o;
  if (lp) { const l = ctx.createBiquadFilter(); l.type = "lowpass"; l.frequency.value = lp; o.connect(l); node = l; }
  node.connect(g).connect(dest);
  o.start(at); o.stop(at + dur + 0.05);
}

function noise(ctx: C, dest: AudioNode, at: number, dur: number, gain: number, from: number, to: number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.8;
  f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(dest); src.start(at);
}

export const tick = (ctx: C, d: AudioNode, at: number) => tone(ctx, d, "square", 1400, at, 0.06, 0.18);
export function heartbeat(ctx: C, d: AudioNode, at: number, until: number) {
  for (let t = at; t < until; t += 0.6) { tone(ctx, d, "sine", 60, t, 0.14, 0.5); tone(ctx, d, "sine", 52, t + 0.18, 0.12, 0.35); }
}
export function chime(ctx: C, d: AudioNode, at: number) {
  [0, 4, 7, 12].forEach((s, i) => tone(ctx, d, "triangle", hz(12 + s), at + i * 0.07, 0.5, 0.2));
}
export const whoosh = (ctx: C, d: AudioNode, at: number) => noise(ctx, d, at, 0.5, 0.35, 300, 3000);

const PROG = [0, 7, 9, 5].map((r) => [r, r + 4 - (r === 9 ? 1 : 0), r + 7]); // C G Am F (semitones above C3)

/** Looping 4-chord bed, family-specific timbre. Sustained pad keeps the level steady for ducking. */
export function musicBed(ctx: C, d: AudioNode, family: MusicFamily, bpm: number, duration: number) {
  const beat = 60 / bpm, bar = beat * 4;
  for (let t = 0, i = 0; t < duration; t += bar, i++) {
    const ch = PROG[i % 4];
    const f = (s: number, oct = 0) => hz(s - 9 + 12 * oct); // semitone above C -> Hz, C3 + oct
    const padType: OscillatorType = family === "orchestral" || family === "synthwave" ? "sawtooth" : "triangle";
    for (const s of ch) tone(ctx, d, padType, f(s, -1) * 2, t, bar * 1.02, 0.05, 900);
    tone(ctx, d, family === "chiptune" ? "square" : "sine", f(ch[0], -2) * 2, t, bar * 0.98, 0.12);
    for (let b = 0; b < 4; b++) {
      const at = t + b * beat;
      if (family === "chiptune") for (let h = 0; h < 2; h++) tone(ctx, d, "square", f(ch[(b * 2 + h) % 3], 1) * 2, at + h * beat / 2, beat / 2 * 0.8, 0.05);
      else if (family === "piano-bells") tone(ctx, d, "sine", f(ch[b % 3], 1) * 4, at, beat * 1.4, 0.05);
      else if (family === "acoustic") tone(ctx, d, "triangle", f(ch[b % 3], 1) * 2, at, beat * 0.9, 0.07);
      else if (family === "synthwave") tone(ctx, d, "sawtooth", f(ch[0], -1) * 2, at + beat / 2, beat * 0.4, 0.06, 700);
      else if (family === "orchestral" && b === 0) tone(ctx, d, "sine", 70, at, 0.35, 0.3);
      else if (family === "pop" && (b === 1 || b === 3)) noise(ctx, d, at, 0.08, 0.06, 2000, 5000);
    }
  }
}
