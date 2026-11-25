export type MusicFamily = "piano-bells" | "chiptune" | "synthwave" | "orchestral" | "acoustic" | "ambient" | "pop";

export function parseMusicMood(mood: string): { bpm: number; family: MusicFamily } {
  const m = mood.toLowerCase();
  const bpmMatch = m.match(/(\d{2,3})\s*bpm/);
  const bpm = bpmMatch ? Math.min(140, Math.max(80, Number(bpmMatch[1]))) : 100;
  const has = (...ks: string[]) => ks.some((k) => m.includes(k));
  const family: MusicFamily = has("chiptune", "8-bit") ? "chiptune"
    : has("synthwave", "electronic", "lo-fi", "chillwave") ? "synthwave"
    : has("orchestral", "cinematic") ? "orchestral"
    : has("acoustic", "folk", "ukulele", "guitar", "pizzicato") ? "acoustic"
    : has("ambient") ? "ambient"
    : has("piano", "bells", "jazz") ? "piano-bells"
    : "pop";
  return { bpm, family };
}

import library from "../../../public/music/library.json";

/** One bundled royalty-free track (all CC0 / public domain, see public/music/CREDITS.md). */
export interface MusicTrack { id: string; title: string; artist: string; license: string; file: string; mood: string[]; source: string }
/** The music library: add a row to public/music/library.json (plus the mp3 next to it) and it shows up in the studio. */
export const LIBRARY: MusicTrack[] = library;
export const trackUrl = (t: MusicTrack) => `/music/${t.file}`;
export const TRACKS = LIBRARY.map(trackUrl);

/** What the user can choose: "auto" (a different track per video), "none", or a track id. */
export type MusicChoice = string;
export const MUSIC_AUTO = "auto", MUSIC_NONE = "none";
export const isMusicChoice = (v: unknown): v is MusicChoice => v === MUSIC_AUTO || v === MUSIC_NONE || LIBRARY.some((t) => t.id === v);

const hash = (key: string) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

/** A stable pick per key (used by the debug tools). */
export function pickTrack(key: string): string {
  return TRACKS[hash(key) % TRACKS.length];
}

/** The track URL for a choice, or null for "no music". "auto" varies with the seed, so each video gets its own track but the same seed always sounds the same. */
export function resolveMusic(choice: MusicChoice, seed: string): string | null {
  if (choice === MUSIC_NONE) return null;
  const t = LIBRARY.find((x) => x.id === choice);
  return t ? trackUrl(t) : TRACKS[hash(`${seed}|music`) % TRACKS.length];
}
