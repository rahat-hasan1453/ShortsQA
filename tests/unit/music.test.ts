import { describe, expect, test } from "vitest";
import { parseMusicMood } from "../../src/engine/audio/music";
import { themes } from "./helpers";

describe("parseMusicMood", () => {
  test("all 15 themes give a finite bpm between 80 and 140 and a family", () => {
    for (const t of themes) {
      const m = parseMusicMood(t.music.mood);
      expect(Number.isFinite(m.bpm), t.id).toBe(true);
      expect(m.bpm, t.id).toBeGreaterThanOrEqual(80);
      expect(m.bpm, t.id).toBeLessThanOrEqual(140);
      expect(m.family, t.id).toBeTruthy();
    }
  });
  test("keywords map to families", () => {
    expect(parseMusicMood("8-bit chiptune, 130 bpm").family).toBe("chiptune");
    expect(parseMusicMood("cinematic orchestral, 100 bpm").family).toBe("orchestral");
    expect(parseMusicMood("playful ukulele, 120 bpm").family).toBe("acoustic");
    expect(parseMusicMood("no tempo given").bpm).toBe(100);
  });
});
