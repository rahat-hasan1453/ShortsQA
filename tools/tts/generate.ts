import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { cartesiaSpeak } from "./cartesia";
import { collectClipRequests, type ClipManifest } from "./clips";

const run = promisify(execFile);
// Edge TTS clips carry leading/trailing silence and loudnorm pads short clips; trim both ends before and after.
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse";
const root = path.resolve(__dirname, "../..");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const useKokoro = Boolean(cfg.kokoroVoice);
const useCartesia = !useKokoro && Boolean(cfg.cartesiaVoice);
const voiceTag: string = useKokoro ? `kokoro:${cfg.kokoroVoice}` : useCartesia ? `cartesia:${cfg.cartesiaVoice}` : cfg.voice;
if (!voiceTag) throw new Error("config.json voice is empty; run audition and choose one");
const audioDir = path.join(root, "public/audio");
const tmpDir = path.join(root, "tmp/tts");
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
const reqs = collectClipRequests(read("voice_lines.json"), read("countries.json"), voiceTag, [...words, ...pictureAnswers, ...read("countries.json").map((c: { funFact?: string }) => c.funFact).filter(Boolean), "Like if you got the first three right!"]);
// Clips are looked up by text, so entries of a previously used voice must not linger.
const wanted = new Set(reqs.map((r) => r.key));
for (const k of Object.keys(manifest)) if (!wanted.has(k)) delete manifest[k];
const todo = reqs.filter((r) => !manifest[r.key] || !fs.existsSync(path.join(audioDir, manifest[r.key].file)));
console.log(`${reqs.length} clips needed, ${todo.length} to generate (voice ${voiceTag})`);

async function make(r: { key: string; text: string }) {
  const raw = path.join(tmpDir, `${r.key}.${useKokoro ? "wav" : "mp3"}`);
  const out = path.join(audioDir, `${r.key}.mp3`);
  if (useKokoro) { /* rendered in one batch beforehand */ } else if (useCartesia) await cartesiaSpeak(r.text, cfg.cartesiaVoice, raw);
  else await run(path.join(root, cfg.edgeTtsBin), ["--voice", cfg.voice, "--text", r.text, "--write-media", raw]);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", TRIM + ",loudnorm=I=-16:TP=-1.5:LRA=11," + TRIM, "-ar", "44100", "-ac", "1", out]);
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]);
  manifest[r.key] = { file: `${r.key}.mp3`, durationMs: Math.round(parseFloat(stdout) * 1000), text: r.text };
  fs.rmSync(raw);
}

async function main() {
  if (useKokoro && todo.length) {
    // One Python process renders every missing clip (the model loads once), then ffmpeg trims/normalises each.
    const items = path.join(tmpDir, "kokoro-items.json");
    fs.writeFileSync(items, JSON.stringify(todo.map((r) => ({ key: r.key, text: r.text }))));
    await new Promise<void>((resolve, reject) => {
      const p = spawn(path.join(root, "tools/tts/.venv-kokoro/bin/python"), [path.join(root, "tools/tts/kokoro/speak.py"), cfg.kokoroVoice, tmpDir, items], { stdio: ["ignore", "ignore", "inherit"] });
      p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(`kokoro exited ${c}`))));
    });
  }
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
  await Promise.all(Array.from({ length: useCartesia ? 2 : 4 }, worker));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
  console.log("done");
}
main().catch((e) => { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n"); console.error(e); process.exit(1); });
