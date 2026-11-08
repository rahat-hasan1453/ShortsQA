import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const out = path.join(root, "tmp/audition");
fs.mkdirSync(out, { recursive: true });
const text = "Can you name all ten flags? Let's find out! It's Bosnia and Herzegovina! Comment your score below.";
for (const voice of cfg.candidates as string[]) {
  const file = path.join(out, `${voice}.mp3`);
  execFileSync(path.join(root, cfg.edgeTtsBin), ["--voice", voice, "--text", text, "--write-media", file], { stdio: "inherit" });
  console.log("wrote", file);
}
