import fs from "node:fs";
import path from "node:path";
import { flagPath } from "../../src/engine/assetPaths";

const root = path.resolve(__dirname, "../..");
const src = path.join(root, "node_modules/flag-icons/flags/4x3");
const countries = JSON.parse(fs.readFileSync(path.join(root, "data/countries.json"), "utf8"));
fs.mkdirSync(path.join(root, "public/flags"), { recursive: true });
const missing: string[] = [];
for (const c of countries) {
  const file = path.join(src, `${c.iso2.toLowerCase()}.svg`);
  if (!fs.existsSync(file)) { missing.push(c.iso2); continue; }
  fs.copyFileSync(file, path.join(root, "public", flagPath(c.iso2)));
}
fs.writeFileSync(
  path.join(root, "public/flags/LICENSE.txt"),
  "Flag SVGs are from the flag-icons package (https://github.com/lipis/flag-icons), MIT License.\nCopyright (c) 2013 Panayiotis Lipiridis.\n",
);
if (missing.length) { console.error("Missing flag SVGs:", missing.join(", ")); process.exit(1); }
console.log(`copied ${countries.length} flags`);
