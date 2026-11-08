import fs from "node:fs";
import path from "node:path";
import { fontFamilies, fontSlug } from "../../src/engine/assetPaths";

const root = path.resolve(__dirname, "../..");
const themes = JSON.parse(fs.readFileSync(path.join(root, "data/themes.json"), "utf8"));
const out = path.join(root, "public/fonts");
fs.mkdirSync(out, { recursive: true });
const missing: string[] = [];
for (const fam of fontFamilies(themes)) {
  const slug = fontSlug(fam);
  const dir = path.join(root, "node_modules/@fontsource", slug, "files");
  let ok = false;
  for (const w of [400, 700]) {
    const f = path.join(dir, `${slug}-latin-${w}-normal.woff2`);
    if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(out, `${slug}-${w}.woff2`)); if (w === 400) ok = true; }
  }
  if (!ok) missing.push(fam);
}
fs.writeFileSync(path.join(out, "LICENSE.txt"), "Fonts are from the @fontsource packages (https://fontsource.org), each licensed under the SIL Open Font License 1.1 or Apache 2.0 as stated by the upstream Google Fonts project.\n");
if (missing.length) { console.error("Missing 400 weight for:", missing.join(", ")); process.exit(1); }
console.log("copied fonts");
