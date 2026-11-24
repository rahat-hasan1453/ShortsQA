import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { voiceById, VOICES, voiceTag } from "../../src/engine/voices";
import { collectClipRequests, pruneStale, voiceArg, type ClipManifest } from "./clips";
import { engineCommand } from "./engines";

const run = promisify(execFile);
// TTS clips carry leading/trailing silence and loudnorm pads short clips; trim both ends before and after.
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse";
const root = path.resolve(__dirname, "../..");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")) as { chatterboxPython: string };
const samplesOnly = process.argv.includes("--samples");
const voice = voiceById(voiceArg(process.argv, VOICES))!;
const tag = voiceTag(voice);
// Each voice has its own folder and manifest, so generating one voice never touches another.
const audioDir = path.join(root, "public/audio", voice.id);
const tmpDir = path.join(root, "tmp/tts", voice.id);
fs.mkdirSync(audioDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });
const manifestPath = path.join(audioDir, "manifest.json");
const manifest: ClipManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const wordsPath = path.join(root, "data", "missing_letters.json");
const words: string[] = fs.existsSync(wordsPath) ? (JSON.parse(fs.readFileSync(wordsPath, "utf8")) as { word: string }[]).map((w) => w.word) : [];
// What-is-it answers are spoken on the reveal; only the ones that have a photo.
const creditsPath = path.join(root, "data", "what_is_it_credits.json");
const photoIds = fs.existsSync(creditsPath) ? new Set(Object.keys(JSON.parse(fs.readFileSync(creditsPath, "utf8")))) : new Set<string>();
const pictureAnswers: string[] = read("what_is_it.json").filter((x: { n: number }) => photoIds.has(`wi${String(x.n).padStart(4, "0")}`)).map((x: { answer: string }) => x.answer);
const reqs = collectClipRequests(read("voice_lines.json"), read("countries.json"), tag, [...words, ...pictureAnswers, ...read("countries.json").map((c: { funFact?: string }) => c.funFact).filter(Boolean), "Like if you got the first three right!"]);
pruneStale(manifest, new Set(reqs.map((r) => r.key)));
const todo = reqs.filter((r) => !manifest[r.key] || !fs.existsSync(path.join(audioDir, manifest[r.key].file)));
console.log(`${reqs.length} clips needed, ${todo.length} to generate (voice ${voice.id}, ${tag})`);

const normalise = (raw: string, out: string) =>
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", TRIM + ",loudnorm=I=-16:TP=-1.5:LRA=11," + TRIM, "-ar", "44100", "-ac", "1", out]);

async function make(r: { key: string; text: string }) {
  const raw = path.join(tmpDir, `${r.key}.wav`);
  const out = path.join(audioDir, `${r.key}.mp3`);
  await normalise(raw, out);
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]);
  manifest[r.key] = { file: `${r.key}.mp3`, durationMs: Math.round(parseFloat(stdout) * 1000), text: r.text };
  fs.rmSync(raw);
}

/** One Python process renders every item (the model loads once); `onClip` runs as each "ok <key>" line arrives. */
function render(items: { key: string; text: string }[], onClip: (key: string) => void): Promise<void> {
  const file = path.join(tmpDir, "items.json");
  fs.writeFileSync(file, JSON.stringify(items));
  const { cmd, args } = engineCommand(voice, cfg, root, os.homedir(), tmpDir, file);
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "inherit"] });
    let buf = "";
    p.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\n"); buf = lines.pop()!;
      for (const l of lines) { const m = l.match(/^ok (\S+)/); if (m) onClip(m[1]); }
    });
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(`${voice.engine} exited ${c}`))));
  });
}

async function samples() {
  const dir = path.join(root, "public/audio/samples");
  fs.mkdirSync(dir, { recursive: true });
  await render([{ key: "sample", text: voice.sampleText }], () => {});
  await normalise(path.join(tmpDir, "sample.wav"), path.join(dir, `${voice.id}.mp3`));
  fs.rmSync(path.join(tmpDir, "sample.wav"));
  console.log(`wrote public/audio/samples/${voice.id}.mp3`);
}

async function main() {
  // Each clip is trimmed, normalised and saved as soon as Python reports it, so a long (Chatterbox) run can be stopped and resumed.
  const byKey = new Map(todo.map((r) => [r.key, r]));
  const pending: Promise<void>[] = [];
  let done = 0;
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
  if (todo.length) {
    await render(todo.map((r) => ({ key: r.key, text: r.text })), (key) => {
      const r = byKey.get(key);
      if (!r) return;
      pending.push(make(r).then(() => { if (++done % 25 === 0) { save(); console.log(`${done}/${todo.length}`); } }));
    });
  }
  await Promise.all(pending);
  save();
  console.log("done");
}
(samplesOnly ? samples() : main()).catch((e) => { if (!samplesOnly) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n"); console.error(e); process.exit(1); });
