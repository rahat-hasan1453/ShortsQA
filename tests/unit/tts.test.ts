import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { segmentLine } from "../../tools/tts/segments";
import { clipKey, collectClipRequests, numberWords } from "../../tools/tts/clips";

const root = path.resolve(__dirname, "../..");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));

describe("segmentLine", () => {
  test("splits at the answer placeholder and trims", () => {
    expect(segmentLine("Did you get {answer}? Nice one!")).toEqual([
      { kind: "text", text: "Did you get" },
      { kind: "slot", name: "answer" },
      { kind: "text", text: "Nice one!" },
    ]);
  });
  test("a line with no placeholder is one text segment", () => {
    expect(segmentLine("Next one!")).toEqual([{ kind: "text", text: "Next one!" }]);
  });
  test("drops punctuation-only segments (TTS cannot speak them)", () => {
    expect(segmentLine("Yes, {answer}!")).toEqual([
      { kind: "text", text: "Yes," },
      { kind: "slot", name: "answer" },
    ]);
  });
  test("drops empty segments when the line starts with a slot", () => {
    expect(segmentLine("{answer} was the answer!")).toEqual([
      { kind: "slot", name: "answer" },
      { kind: "text", text: "was the answer!" },
    ]);
  });
});

describe("clipKey", () => {
  test("is stable and differs for different text or voice", () => {
    expect(clipKey("v", "hello")).toBe(clipKey("v", "hello"));
    expect(clipKey("v", "hello")).not.toBe(clipKey("v", "hello!"));
    expect(clipKey("v", "hello")).not.toBe(clipKey("w", "hello"));
    expect(clipKey("v", "hello")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("collectClipRequests", () => {
  const reqs = collectClipRequests(read("voice_lines.json"), read("countries.json"), "v");
  test("includes long country names and number words", () => {
    const texts = reqs.map((r) => r.text);
    expect(texts).toContain("Saint Vincent and the Grenadines");
    expect(texts).toContain("forty-two");
    expect(texts).toContain("zero");
    expect(numberWords(99)).toBe("ninety-nine");
  });
  test("has no duplicate keys and includes regions", () => {
    expect(new Set(reqs.map((r) => r.key)).size).toBe(reqs.length);
    expect(reqs.map((r) => r.text)).toContain("the world");
  });
});

import { voiceById } from "../../src/engine/voices";
import { engineCommand } from "../../tools/tts/engines";

test("kokoro command uses the project venv and the voice name", () => {
  expect(engineCommand(voiceById("am_adam")!, { chatterboxPython: "~/x/python" }, "/r", "/h", "/o", "/i.json"))
    .toEqual({ cmd: "/r/tools/tts/.venv-kokoro/bin/python", args: ["/r/tools/tts/kokoro/speak.py", "am_adam", "/o", "/i.json"] });
});

test("chatterbox command expands ~ and defaults the reference", () => {
  expect(engineCommand(voiceById("chatterbox")!, { chatterboxPython: "~/tts-test/env/bin/python" }, "/r", "/h", "/o", "/i.json"))
    .toEqual({ cmd: "/h/tts-test/env/bin/python", args: ["/r/tools/tts/chatterbox/speak.py", "default", "/o", "/i.json"] });
});
