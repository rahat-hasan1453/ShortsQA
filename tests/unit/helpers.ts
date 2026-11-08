import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));

export const countries = read("countries.json");
export const themes = read("themes.json");
export const voice = read("voice_lines.json").find((f: any) => f.format === "flags");
export const clipMsRealistic = (text: string) => 300 + 45 * text.length;
