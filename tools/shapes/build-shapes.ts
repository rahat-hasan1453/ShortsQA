/**
 * Builds public/shapes.json: one SVG outline per country, from Natural Earth (public domain) via the
 * `world-atlas` package. Each shape is fitted into a box whose longer side is 1000 units.
 *   npx tsx tools/shapes/build-shapes.ts
 */
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";

const ROOT = path.resolve(__dirname, "../..");
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, `node_modules/world-atlas/${f}`), "utf8"));
// 50m for everything; the finer 10m outlines replace any 50m outline that has too few points to be recognisable (Singapore, Malta...).
const SOURCES = [load("countries-50m.json"), load("countries-10m.json")];
const countries: { iso2: string; name: string; altNames: string[] }[] = JSON.parse(fs.readFileSync(path.join(ROOT, "data/countries.json"), "utf8"));

// world-atlas names that differ from data/countries.json
const ALIAS: Record<string, string> = {
  "Dem. Rep. Congo": "DR Congo", "Congo": "Republic of the Congo", "Central African Rep.": "Central African Republic", "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Czechia": "Czech Republic", "Dominican Rep.": "Dominican Republic", "Eq. Guinea": "Equatorial Guinea", "S. Sudan": "South Sudan",
  "United States of America": "United States", "Solomon Is.": "Solomon Islands", "eSwatini": "Eswatini", "N. Cyprus": "", "Somaliland": "", "W. Sahara": "",
  "Fr. S. Antarctic Lands": "", "Falkland Is.": "", "Antarctica": "", "Greenland": "", "New Caledonia": "", "Puerto Rico": "", "Taiwan": "Taiwan",
  "Palestine": "Palestine", "Côte d'Ivoire": "Ivory Coast", "Timor-Leste": "East Timor", "St. Vin. and Gren.": "Saint Vincent and the Grenadines",
  "Antigua and Barb.": "Antigua and Barbuda", "St. Kitts and Nevis": "Saint Kitts and Nevis", "São Tomé and Principe": "Sao Tome and Principe",
  "Marshall Is.": "Marshall Islands", "Cayman Is.": "", "Cook Is.": "", "Micronesia": "Micronesia", "North Macedonia": "North Macedonia", "Macedonia": "North Macedonia",
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const byName = new Map<string, string>();
for (const c of countries) for (const n of [c.name, ...c.altNames]) byName.set(norm(n), c.iso2);

type Ring = [number, number][];
const out: Record<string, { d: string; w: number; h: number; ok: boolean }> = {};
const unmatched: string[] = [];

const ringArea = (r: Ring) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
const centroid = (r: Ring): [number, number] => [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];

const pointCount = (d: string) => (d.match(/[ML]/g) ?? []).length;
for (const [pass, topo] of SOURCES.entries()) for (const f of (feature(topo, topo.objects.countries) as any).features) {
  const name: string = f.properties.name;
  const target = ALIAS[name] ?? name;
  const iso2 = target ? byName.get(norm(target)) : undefined;
  if (!iso2) { if (target && pass === 0) unmatched.push(name); continue; }
  if (pass === 1 && out[iso2] && pointCount(out[iso2].d) >= 80) continue;
  let polys: Ring[][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  // Countries that straddle the antimeridian (Fiji, Russia, USA): move the western half to 180..360 before measuring anything.
  const allLon = polys.flatMap((p) => p.flatMap((r) => r.map((q) => q[0])));
  if (Math.max(...allLon) > 170 && Math.min(...allLon) < -170) polys = polys.map((p) => p.map((r) => r.map(([x, y]) => [x < 0 ? x + 360 : x, y] as [number, number])));
  const area = (p: Ring[]) => ringArea(p[0]) * Math.cos((centroid(p[0])[1] * Math.PI) / 180);
  const biggest = polys.reduce((a, b) => (area(b) > area(a) ? b : a));
  const [bx, by] = centroid(biggest[0]);
  // Keep the main land mass plus sizeable neighbours (drops far-flung territories such as French Guiana or Alaska).
  const total = polys.reduce((a, p) => a + area(p), 0);
  const kept = polys.filter((p) => {
    if (p === biggest) return true;
    const [cx, cy] = centroid(p[0]);
    const dx = Math.min(Math.abs(cx - bx), 360 - Math.abs(cx - bx));
    return Math.hypot(dx, cy - by) < 30 && area(p) > total * 0.002;
  });
  const pts = kept.flatMap((p) => p[0]);
  const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
  const minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180); // equirectangular, corrected at the mid latitude
  const sw = (maxX - minX) * k, sh = maxY - minY, scale = 1000 / Math.max(sw, sh);
  const W = Math.round(sw * scale * 10) / 10, H = Math.round(sh * scale * 10) / 10;
  let d = "";
  for (const poly of kept) {
    for (const ring of poly) {
      let last: [number, number] | null = null, seg = "";
      ring.forEach(([x, y], i) => {
        const px = Math.round((x - minX) * k * scale * 10) / 10, py = Math.round((maxY - y) * scale * 10) / 10;
        if (last && i < ring.length - 1 && Math.hypot(px - last[0], py - last[1]) < 1.2) return; // drop near-duplicate points
        seg += `${last ? "L" : "M"}${px} ${py}`; last = [px, py];
      });
      if (seg) d += seg + "Z";
    }
  }
  // "ok" = the main land mass fills a decent part of the frame; scattered atolls (Maldives, Kiribati...) would show as specks.
  const bb = (r: Ring) => { const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); return (Math.max(...xs) - Math.min(...xs)) * k * (Math.max(...ys) - Math.min(...ys)); };
  const ok = bb(biggest[0]) * scale * scale >= 0.06 * 1000 * 1000 * (sw / Math.max(sw, sh)) * (sh / Math.max(sw, sh));
  out[iso2] = { d, w: W, h: H, ok };
}
fs.writeFileSync(path.join(ROOT, "public/shapes.json"), JSON.stringify(out));
const missing = countries.filter((c) => !out[c.iso2]).map((c) => c.iso2 + " " + c.name);
console.log(`shapes: ${Object.keys(out).length}/${countries.length}, ${(fs.statSync(path.join(ROOT, "public/shapes.json")).size / 1024).toFixed(0)} KB`);
console.log("unmatched in atlas:", unmatched.join(", ") || "none");
console.log("scattered (not used in quizzes):", Object.entries(out).filter(([, v]) => !v.ok).map(([i]) => i).join(", ") || "none");
console.log("countries without a shape:", missing.join(", ") || "none");
