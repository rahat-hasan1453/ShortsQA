import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { collectClipRequests, type ClipManifest } from "./clips";

const run = promisify(execFile);
// Edge TTS clips carry leading/trailing silence and loudnorm pads short clips; trim both ends before and after.
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse";
const root = path.resolve(__dirname, "../..");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
if (!cfg.voice) throw new Error("config.json voice is empty; run audition and choose one");
const audioDir = path.join(root, "public/audio");
const tmpDir = path.join(root, "tmp/tts");
fs.mkdirSync(audioDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });
const manifestPath = path.join(audioDir, "manifest.json");
const manifest: ClipManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const reqs = collectClipRequests(read("voice_lines.json"), read("countries.json"), cfg.voice);
const todo = reqs.filter((r) => !manifest[r.key] || !fs.existsSync(path.join(audioDir, manifest[r.key].file)));
console.log(`${reqs.length} clips needed, ${todo.length} to generate (voice ${cfg.voice})`);

async function make(r: { key: string; text: string }) {
  const raw = path.join(tmpDir, `${r.key}.mp3`);
  const out = path.join(audioDir, `${r.key}.mp3`);
  await run(path.join(root, cfg.edgeTtsBin), ["--voice", cfg.voice, "--text", r.text, "--write-media", raw]);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", TRIM + ",loudnorm=I=-16:TP=-1.5:LRA=11," + TRIM, "-ar", "44100", "-ac", "1", out]);
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]);
  manifest[r.key] = { file: `${r.key}.mp3`, durationMs: Math.round(parseFloat(stdout) * 1000), text: r.text };
  fs.rmSync(raw);
}

async function main() {
  let i = 0, done = 0;
  const worker = async () => {
    while (i < todo.length) {
      const r = todo[i++];
      for (let attempt = 1; ; attempt++) {
        try { await make(r); break; } catch (e) { if (attempt >= 3) throw e; await new Promise((res) => setTimeout(res, 1000 * attempt)); }
      }
      if (++done % 25 === 0) { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1)); console.log(`${done}/${todo.length}`); }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
  console.log("done");
}
main().catch((e) => { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n"); console.error(e); process.exit(1); });
