import { CLIP_GAP_MS, lineById, lineTexts, slotValues } from "./lines";
import type { Cue, QuizSpec, Scene, Timeline, VoiceLines } from "./types";

export class DurationError extends Error {}

export const HOOK_MIN = 3.0;
export const TIMER_SEC = 3.0;
export const TIMER_LAST_SEC = 4.0;
export const REVEAL_MIN = 1.5;
export const DIFFUP_SEC = 0.8;
export const OUTRO_MIN = 4.0;
export const MAX_DURATION = 59;
const PAD = 0.2;

export function buildTimeline(spec: QuizSpec, deps: { clipMs: (text: string) => number; voice: VoiceLines }): Timeline {
  const { clipMs, voice } = deps;
  const scenes: Scene[] = [];
  const cues: Cue[] = [];
  let voiceFree = 0;

  const speak = (lineId: string, desired: number, q?: (typeof spec.questions)[number]): { start: number; end: number } => {
    const clips = lineTexts(lineById(voice, lineId), slotValues(spec, q));
    const sec = (clips.reduce((a, t) => a + clipMs(t), 0) + CLIP_GAP_MS * Math.max(0, clips.length - 1)) / 1000;
    const start = Math.max(desired, voiceFree + 0.05);
    voiceFree = start + sec;
    cues.push({ at: start, kind: "voice", clips });
    return { start, end: start + sec };
  };

  let t = 0;
  const hook = speak(spec.hookLineId, 0.2);
  scenes.push({ kind: "hook", start: 0, end: Math.max(HOOK_MIN, hook.end + PAD) });
  t = scenes[0].end;

  for (const q of spec.questions) {
    const diffUp = spec.difficultyUpLineIds[q.index];
    if (diffUp !== undefined && q.index in spec.difficultyUpLineIds) {
      scenes.push({ kind: "diffUp", start: t, end: t + DIFFUP_SEC, q: q.index });
      cues.push({ at: t, kind: "whoosh" });
      speak(diffUp, t + 0.05);
      t += DIFFUP_SEC;
    }
    const last = q.index === spec.questions.length - 1;
    const timerSec = last ? TIMER_LAST_SEC : TIMER_SEC;
    scenes.push({ kind: "timer", start: t, end: t + timerSec, q: q.index });
    if (last) cues.push({ at: t, kind: "heartbeat" });
    for (let k = timerSec - 3; k < timerSec; k++) cues.push({ at: t + k, kind: "tick" });
    const startLine = q.askLineId ?? q.transitionLineId;
    if (startLine) speak(startLine, t + 0.1, q);
    if (q.countdownLineId) speak(q.countdownLineId, t + 1.2, q);
    t += timerSec;

    const rv = speak(q.revealLineId, t + 0.1, q);
    cues.push({ at: t, kind: "chime" });
    const end = Math.max(t + REVEAL_MIN, rv.end + PAD);
    scenes.push({ kind: "reveal", start: t, end, q: q.index });
    t = end;
  }

  const outro = speak(spec.outroLineId, t + 0.2);
  const outroEnd = Math.max(t + OUTRO_MIN, outro.end + 0.3);
  scenes.push({ kind: "outro", start: t, end: outroEnd });

  const duration = outroEnd;
  if (duration > MAX_DURATION) throw new DurationError(`timeline is ${duration.toFixed(1)}s, max ${MAX_DURATION}s (seed ${spec.seed})`);
  cues.sort((a, b) => a.at - b.at);
  return { spec, duration, scenes, cues };
}
