import { describe, expect, test } from "vitest";
import { isMusicChoice, LIBRARY, parseMusicMood, pickTrack, resolveMusic, TRACKS } from "../../src/engine/audio/music";
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

describe("pickTrack", () => {
  test("is stable per theme and always a bundled track", () => {
    for (const t of themes) {
      expect(pickTrack(t.music.mood)).toBe(pickTrack(t.music.mood));
      expect(TRACKS).toContain(pickTrack(t.music.mood));
    }
  });
  test("bundled files exist", async () => {
    const fs = await import("node:fs");
    for (const t of TRACKS) expect(fs.existsSync("public" + t), t).toBe(true);
  });
});

describe("music library", () => {
  test("every entry has credits, a CC0/public-domain licence and a unique id", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(4);
    expect(new Set(LIBRARY.map((t) => t.id)).size).toBe(LIBRARY.length);
    for (const t of LIBRARY) {
      expect(t.title && t.artist && t.source, t.id).toBeTruthy();
      expect(t.license, t.id).toMatch(/^(CC0|Public domain)/i);
    }
  });
  test("resolveMusic: none is null, a track id is that track, auto is stable per seed and varies across seeds", () => {
    expect(resolveMusic("none", "s")).toBeNull();
    expect(resolveMusic(LIBRARY[1].id, "s")).toBe(`/music/${LIBRARY[1].file}`);
    expect(resolveMusic("auto", "seed-1")).toBe(resolveMusic("auto", "seed-1"));
    const picks = new Set(Array.from({ length: 40 }, (_, i) => resolveMusic("auto", `seed-${i}`)));
    expect(picks.size).toBeGreaterThan(Math.min(LIBRARY.length, 4) - 1);
    expect(resolveMusic("gone-track", "s")).toBe(resolveMusic("auto", "s"));
  });
  test("isMusicChoice accepts auto, none and library ids only", () => {
    expect(isMusicChoice("auto") && isMusicChoice("none") && isMusicChoice(LIBRARY[0].id)).toBe(true);
    expect(isMusicChoice("nope") || isMusicChoice(null)).toBe(false);
  });
});
