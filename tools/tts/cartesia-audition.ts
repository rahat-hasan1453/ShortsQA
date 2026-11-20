/** Renders the same quiz line in every English Cartesia stock voice into tmp/audition-cartesia/ plus an index.html to listen. */
import fs from "node:fs";
import path from "node:path";
import { cartesiaSpeak, listVoices } from "./cartesia";

const out = path.resolve(__dirname, "../../tmp/audition-cartesia");
fs.mkdirSync(out, { recursive: true });
const text = "Can you name all ten flags? Let's find out! It's Bosnia and Herzegovina! Comment your score below.";
const limit = Number(process.argv[2]) || 12;

async function main() {
  const voices = (await listVoices()).filter((v) => v.language === "en").slice(0, limit);
  const rows: string[] = [];
  for (const v of voices) {
    const f = `${v.id}.mp3`;
    await cartesiaSpeak(text, v.id, path.join(out, f));
    rows.push(`<div><b>${v.name}</b> <small>${v.gender ?? ""} - ${v.description ?? ""}</small><br><code>${v.id}</code><br><audio controls src="${f}"></audio></div>`);
    console.log("ok", v.name, v.id);
  }
  fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset=utf-8><title>Cartesia voices</title><body style="font:15px system-ui;max-width:640px;margin:20px auto;padding:0 16px">${rows.join("<hr>")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
