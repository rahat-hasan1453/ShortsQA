import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { makeClipIndex } from "../../src/engine/clipIndex";
import { audioDir, DEFAULT_VOICE_ID, voiceById, VOICES, voiceTag } from "../../src/engine/voices";
import { pruneStale } from "../../tools/tts/clips";

const root = path.resolve(__dirname, "../..");

test("registry: unique ids, exactly one default, kokoro entries name their voice", () => {
  expect(new Set(VOICES.map((v) => v.id)).size).toBe(VOICES.length);
  expect(VOICES.filter((v) => v.default).map((v) => v.id)).toEqual(["af_heart"]);
  expect(DEFAULT_VOICE_ID).toBe("af_heart");
  for (const v of VOICES.filter((x) => x.engine === "kokoro")) expect(v.voice).toBe(v.id);
  expect(VOICES.map((v) => v.id)).toEqual(["af_heart", "af_bella", "am_michael", "am_adam", "bf_emma", "chatterbox"]);
});

test("voiceTag keeps the existing af_heart clip keys", () => {
  expect(voiceTag(voiceById("af_heart")!)).toBe("kokoro:af_heart");
  expect(voiceTag(voiceById("chatterbox")!)).toBe("chatterbox:default");
  expect(audioDir("am_adam")).toBe("/audio/am_adam");
});

test("clip files live in the voice folder and a missing line names the voice", () => {
  const idx = makeClipIndex({ k: { file: "k.mp3", durationMs: 5, text: "Hi" } }, "am_adam");
  expect(idx.file("Hi")).toBe("/audio/am_adam/k.mp3");
  expect(() => idx.ms("Bye")).toThrow('no "am_adam" voice clip for "Bye"');
});

test("pruning stale entries only touches the manifest it is given", () => {
  const a = { x: { file: "x.mp3", durationMs: 1, text: "X" }, y: { file: "y.mp3", durationMs: 1, text: "Y" } };
  const b = { z: { file: "z.mp3", durationMs: 1, text: "Z" } };
  pruneStale(a, new Set(["x"]));
  expect(Object.keys(a)).toEqual(["x"]);
  expect(Object.keys(b)).toEqual(["z"]);
});

test("af_heart clips moved into their own folder", () => {
  const dir = path.join(root, "public/audio/af_heart");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as Record<string, { file: string }>;
  expect(Object.keys(manifest).length).toBeGreaterThan(1000);
  const missing = Object.values(manifest).filter((e) => !fs.existsSync(path.join(dir, e.file)));
  expect(missing).toEqual([]);
  expect(fs.existsSync(path.join(root, "public/audio/manifest.json"))).toBe(false);
});
