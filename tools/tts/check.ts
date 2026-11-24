import fs from "node:fs";
import path from "node:path";
import { voiceById, VOICES, voiceTag } from "../../src/engine/voices";
import { collectClipRequests, voiceArg, type ClipManifest } from "./clips";

const root = path.resolve(process.env.ASSET_ROOT ?? path.join(__dirname, "../.."));
const voiceId = voiceArg(process.argv, VOICES);
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const wordsPath = path.join(root, "data", "missing_letters.json");
const words: string[] = fs.existsSync(wordsPath) ? (JSON.parse(fs.readFileSync(wordsPath, "utf8")) as { word: string }[]).map((w) => w.word) : [];
const dir = path.join(root, "public/audio", voiceId);
const manifestPath = path.join(dir, "manifest.json");
const problems: string[] = [];
if (!fs.existsSync(manifestPath)) problems.push(`public/audio/${voiceId}/manifest.json missing`);
else {
  const manifest: ClipManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const r of collectClipRequests(read("voice_lines.json"), read("countries.json"), voiceTag(voiceById(voiceId)!), words)) {
    const e = manifest[r.key];
    if (!e) problems.push(`no manifest entry: "${r.text}"`);
    else if (!fs.existsSync(path.join(dir, e.file))) problems.push(`file missing: ${e.file} ("${r.text}")`);
  }
}
if (problems.length) { console.error(problems.slice(0, 30).join("\n")); console.error(`${problems.length} asset problems (voice ${voiceId})`); process.exit(1); }
console.log(`assets ok (voice ${voiceId})`);
