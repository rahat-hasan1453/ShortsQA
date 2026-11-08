import fs from "node:fs";
import path from "node:path";
import { collectClipRequests, type ClipManifest } from "./clips";

const root = path.resolve(process.env.ASSET_ROOT ?? path.join(__dirname, "../.."));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const manifestPath = path.join(root, "public/audio/manifest.json");
const problems: string[] = [];
if (!fs.existsSync(manifestPath)) problems.push("public/audio/manifest.json missing");
else {
  const manifest: ClipManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const r of collectClipRequests(read("voice_lines.json"), read("countries.json"), cfg.voice)) {
    const e = manifest[r.key];
    if (!e) problems.push(`no manifest entry: "${r.text}"`);
    else if (!fs.existsSync(path.join(root, "public/audio", e.file))) problems.push(`file missing: ${e.file} ("${r.text}")`);
  }
}
if (problems.length) { console.error(problems.slice(0, 30).join("\n")); console.error(`${problems.length} asset problems`); process.exit(1); }
console.log("assets ok");
