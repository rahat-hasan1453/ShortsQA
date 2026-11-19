/**
 * (what-is-it variant) Downloads one photo per item from Wikimedia Commons into public/what-is-it/<id>.jpg
 * (960x720, cover-cropped) and records author + licence in data/what_is_it_credits.json.
 * Resumable: landmarks that already have a file are skipped.
 *   npx tsx tools/what-is-it/fetch-images.ts [--limit N] [--only lm001,lm002]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/what-is-it");
const CREDITS = path.join(ROOT, "data/what_is_it_credits.json");
const UA = "ShortsQuizGenerator/1.0 (educational quiz video tool)";
const OK_LICENSE = /^(cc0|cc[- ]by|public domain|pd|attribution)/i;
const BAD_TITLE = /\b(map|flag|logo|coat of arms|diagram|drawing|painting|poster|stamp|icon|symbol|banner|skeleton|anatomy|illustration)\b|\.svg|\.tif|\.png|\.gif|\.webp/i;

interface Landmark { id: string; name: string; altAnswers: string[]; imageSearch: string[] }
const idOf = (n: number) => `wi${String(n).padStart(4, "0")}`;
interface Credit { title: string; author: string; license: string; source: string; query?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** fetch with backoff: Wikimedia answers 429 (empty body) when we go too fast. */
async function wfetch(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 7; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status !== 429 && res.status < 500) return res;
    await sleep(Math.min(60000, 4000 * 2 ** attempt));
  }
  throw new Error("throttled");
}

async function api(params: Record<string, string>): Promise<any> {
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: "json", ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await wfetch(url);
    if (res.ok) return res.json();
  }
  throw new Error("api failed");
}

const STOP = new Set(["the", "of", "de", "la", "le", "du", "and", "in", "at", "to"]);
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const stem = (w: string) => w.replace(/(es|s)$/, "");
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
/** The file title must contain every word of the landmark's name (or an alternative name / search phrase). */
const titleMatches = (title: string, phrases: string[]) => {
  const have = new Set(tokens(title));
  return phrases.some((ph) => { const t = tokens(ph); return t.length > 0 && t.every((w) => have.has(w)); });
};

async function findPhoto(query: string, phrases: string[]) {
  const data = await api({
    action: "query", generator: "search", gsrsearch: query, gsrnamespace: "6", gsrlimit: "12",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1280",
  });
  const pages: any[] = Object.values(data?.query?.pages ?? {});
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || info.mime !== "image/jpeg" || BAD_TITLE.test(p.title) || !titleMatches(p.title, phrases)) continue;
    if (info.width < 1000 || info.height < 700 || info.width / info.height < 1.15) continue; // landscape only
    const meta = info.extmetadata ?? {};
    const license: string = meta.LicenseShortName?.value ?? "";
    if (!OK_LICENSE.test(license)) continue;
    return {
      thumb: info.thumburl as string,
      credit: { title: p.title as string, author: strip(meta.Artist?.value ?? "Unknown"), license, source: info.descriptionurl as string, query } as Credit,
    };
  }
  return null;
}

/** The Wikipedia article's lead image: editors choose an iconic, representative photo. */
async function leadImage(titles: string[]) {
  for (const title of titles) {
    const wp = await wfetch(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ format: "json", action: "query", redirects: "1", prop: "pageimages", piprop: "name", titles: title })}`);
    if (!wp.ok) continue;
    const page: any = Object.values((await wp.json())?.query?.pages ?? {})[0];
    const file: string | undefined = page?.pageimage;
    await sleep(800);
    if (!file || !/\.jpe?g$/i.test(file) || BAD_TITLE.test(file)) continue;
    const data = await api({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1280" });
    const p2: any = Object.values(data?.query?.pages ?? {})[0];
    const info = p2?.imageinfo?.[0];
    if (!info || info.width < 800 || info.width / info.height < 0.8) continue;
    const meta = info.extmetadata ?? {};
    const license: string = meta.LicenseShortName?.value ?? "";
    if (!OK_LICENSE.test(license)) continue;
    return { thumb: info.thumburl as string, credit: { title: p2.title as string, author: strip(meta.Artist?.value ?? "Unknown"), license, source: info.descriptionurl as string, query: `wikipedia:${title}` } as Credit };
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(args[args.indexOf("--limit") + 1]) || Infinity;
  const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
  const raw: any[] = JSON.parse(fs.readFileSync(path.join(ROOT, "data/what_is_it.json"), "utf8"));
  // interleave categories so a partial run still covers everything
  const landmarks: Landmark[] = raw.map((x) => ({ id: idOf(x.n), name: x.answer, altAnswers: x.altAnswers ?? [], imageSearch: x.imageSearch ?? [] })).sort((a, b) => (Number(a.id.slice(2)) % 7) - (Number(b.id.slice(2)) % 7) || a.id.localeCompare(b.id));
  const credits: Record<string, Credit> = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, "utf8")) : {};
  const missing: string[] = [];
  fs.mkdirSync(OUT, { recursive: true });
  let done = 0;
  for (const lm of landmarks) {
    if (only && !only.has(lm.id)) continue;
    const file = path.join(OUT, `${lm.id}.jpg`);
    const lead = true;
    if (fs.existsSync(file) && !(lead && !String(credits[lm.id]?.query).startsWith("wikipedia:"))) continue;
    if (done++ >= limit) break;
    let found: Awaited<ReturnType<typeof findPhoto>> = null;
    if (lead) { try { found = await leadImage([lm.name, ...lm.altAnswers]); } catch (e) { console.log(`THROTTLED ${lm.id}`); await sleep(30000); continue; } await sleep(800); }
    if (!found) for (const q of [] as string[]) {
      try { found = await findPhoto(q, [lm.name, ...lm.altAnswers, ...lm.imageSearch]); } catch { await sleep(5000); found = null; }
      await sleep(400);
      if (found) break;
    }
    if (!found && fs.existsSync(file)) { console.log(`KEEP ${lm.id} (no lead image)`); continue; }
    if (!found) { missing.push(lm.id); console.log(`MISS ${lm.id} ${lm.name}`); continue; }
    let res: Response;
    try { res = await wfetch(found.thumb); } catch { console.log(`THROTTLED ${lm.id} download`); await sleep(60000); continue; }
    if (!res.ok) { missing.push(lm.id); console.log(`FAIL ${lm.id} download ${res.status}`); await sleep(2000); continue; }
    const tmp = path.join(OUT, `${lm.id}.src`);
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    try {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-vf", "scale=960:720:force_original_aspect_ratio=increase,crop=960:720", "-q:v", "5", file]);
    } finally { fs.rmSync(tmp, { force: true }); }
    credits[lm.id] = found.credit;
    fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 1));
    console.log(`OK   ${lm.id} ${lm.name} <- ${found.credit.title} (${found.credit.license})`);
    await sleep(1500);
  }
  console.log(`done. missing: ${missing.length ? missing.join(",") : "none"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
