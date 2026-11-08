import fs from "node:fs";
import path from "node:path";
import { applyFixes, mergeParts, type Fix } from "./merge";
import {
  validateCountries, validateLandmarks, validateMissingLetters,
  validateTitles, validateVoiceLines, validateWhatIsIt, type Issue,
} from "./validators";

const root = path.resolve(__dirname, "../..");
const dataDir = path.join(root, "data");
const incoming = path.join(dataDir, "incoming");

const SOURCES: Record<string, string> = {
  countries: "countries_master", themes: "themes", voice_lines: "voice_lines", titles: "titles",
  landmarks: "landmarks", what_is_it: "what_is_it", missing_letters: "missing_letters",
};

const merged: Record<string, any[]> = {};
for (const [name, prefix] of Object.entries(SOURCES)) merged[name] = mergeParts(incoming, prefix) as any[];
for (const rows of Object.values(merged)) if (rows.every((r) => typeof r?.n === "number")) rows.sort((a, b) => a.n - b.n);

const fixes = JSON.parse(fs.readFileSync(path.join(dataDir, "fixes.json"), "utf8")) as Fix[];
const data = applyFixes(merged, fixes);

const issues: Issue[] = [
  ...validateCountries(data.countries),
  ...validateVoiceLines(data.voice_lines),
  ...validateTitles(data.titles),
  ...validateWhatIsIt(data.what_is_it),
  ...validateLandmarks(data.landmarks, data.countries),
  ...validateMissingLetters(data.missing_letters),
];
if (data.themes.length !== 15) issues.push({ file: "themes", rule: "count", message: `${data.themes.length}/15` });
if (new Set(data.themes.map((t) => t.id)).size !== data.themes.length) issues.push({ file: "themes", rule: "duplicate-id", message: "theme ids" });

const errors = issues.filter((i) => i.severity !== "warn");
const warns = issues.filter((i) => i.severity === "warn");
for (const i of errors) console.error(`ERROR ${i.file}${i.n ? "#" + i.n : ""} [${i.rule}] ${i.message}`);
console.warn(`${warns.length} warnings (missing_letters is incomplete: ${data.missing_letters.length}/1000)`);
if (errors.length) {
  console.error(`${errors.length} errors; data files not written`);
  process.exit(1);
}
for (const [name, rows] of Object.entries(data)) fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(rows, null, 1) + "\n");
console.log(Object.entries(data).map(([k, v]) => `${k}: ${v.length}`).join(", "));
