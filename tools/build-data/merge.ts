import fs from "node:fs";
import path from "node:path";

export type Fix = {
  file: string;
  n?: number;
  field?: string;
  op: "remove" | "replace" | "set" | "dropRow";
  value?: unknown;
  with?: unknown;
};

export function mergeParts(dir: string, prefix: string): unknown[] {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix + ".part") && f.endsWith(".json")).sort();
  return files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as unknown[]);
}

const same = (a: unknown, b: unknown) => String(a).toLowerCase() === String(b).toLowerCase();

function fixValue(v: unknown, fix: Fix): unknown {
  if (Array.isArray(v)) {
    if (fix.op === "remove") return v.filter((x) => !same(x, fix.value));
    if (fix.op === "replace") return v.map((x) => (same(x, fix.value) ? fix.with : x));
    return v;
  }
  if (typeof v === "string" && fix.op === "replace" && same(v, fix.value)) return fix.with;
  return v;
}

export function applyFixes(datasets: Record<string, any[]>, fixes: Fix[]): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const [k, rows] of Object.entries(datasets)) out[k] = rows.map((r) => ({ ...r }));
  for (const fix of fixes) {
    const rows = out[fix.file] ?? [];
    if (fix.op === "dropRow") {
      out[fix.file] = rows.filter((r) => r.n !== fix.n);
      continue;
    }
    for (const r of rows) {
      if (fix.n !== undefined && r.n !== fix.n) continue;
      const fields = fix.field ? [fix.field] : Object.keys(r);
      for (const f of fields) {
        if (fix.op === "set") r[f] = fix.with;
        else r[f] = fixValue(r[f], fix);
      }
    }
  }
  for (const rows of Object.values(out)) {
    for (const r of rows) {
      if (Array.isArray(r.altAnswers) && typeof r.answer === "string") {
        const seen = new Set<string>([r.answer.toLowerCase()]);
        r.altAnswers = r.altAnswers.filter((a: string) => (seen.has(a.toLowerCase()) ? false : (seen.add(a.toLowerCase()), true)));
      }
    }
  }
  return out;
}
