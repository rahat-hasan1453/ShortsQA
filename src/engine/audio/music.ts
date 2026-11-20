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

/** Bundled royalty-free tracks (CC0 / public domain, see public/music/CREDITS.md). */
export const TRACKS = ["/music/track1.mp3", "/music/track2.mp3", "/music/track3.mp3", "/music/track4.mp3"];

/** A stable pick per theme so a theme always sounds the same. */
export function pickTrack(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TRACKS[h % TRACKS.length];
}
