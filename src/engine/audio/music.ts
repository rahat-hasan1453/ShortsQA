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
