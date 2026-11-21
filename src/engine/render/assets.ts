import { flagPath, photoPath, fontFile, fontFileBold, fontSlug } from "../assetPaths";
import { AssetError } from "../errors";
import type { Theme } from "../types";

export interface Assets {
  flags: Map<string, ImageBitmap>;
  /** Country outlines (SVG path in a box whose longer side is 1000 units). */
  shapes: Map<string, { path: Path2D; w: number; h: number }>;
  /** Landmark photos by landmark id. */
  images: Map<string, ImageBitmap>;
  /** Optional user background, cover-fitted to 1080x1920. */
  background?: ImageBitmap;
  fontsOk: boolean;
  warnings: string[];
}

async function rasterFlag(iso2: string): Promise<ImageBitmap> {
  const res = await fetch(flagPath(iso2));
  if (!res.ok) throw new AssetError(`flag ${iso2} failed to load (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = new OffscreenCanvas(1080, 810);
    c.getContext("2d")!.drawImage(img, 0, 0, 1080, 810);
    return await createImageBitmap(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Loads the theme's fonts and only the flags this quiz needs (a full set would be ~800 MB of bitmaps). */
export const fakeKey = (iso2: string) => `${iso2}|fake`;

/** A colour-shifted copy of a flag for the real-or-fake quiz. */
async function fakeFlag(real: ImageBitmap, hue: number): Promise<ImageBitmap> {
  const c = new OffscreenCanvas(real.width, real.height);
  const g = c.getContext("2d")!;
  g.filter = `hue-rotate(${hue}deg)`;
  g.drawImage(real, 0, 0);
  return createImageBitmap(c);
}

let shapeFile: Promise<Record<string, { d: string; w: number; h: number }>> | null = null;

const fontLoads = new Map<string, Promise<boolean>>();

/** Registers one family's 400 (required) and 700 (optional) faces with the document, once per family; false if the 400 file is missing. */
export function ensureFont(family: string): Promise<boolean> {
  if (!fontLoads.has(family)) {
    fontLoads.set(family, (async () => {
      try {
        for (const [url, weight] of [[fontFile(family), "400"], [fontFileBold(family), "700"]] as const) {
          const res = await fetch(url);
          if (!res.ok) { if (weight === "400") throw new Error(String(res.status)); continue; }
          const face = new FontFace(family, await res.arrayBuffer(), { weight });
          await face.load();
          document.fonts.add(face);
        }
        return true;
      } catch {
        fontLoads.delete(family); // a later call may retry
        return false;
      }
    })());
  }
  return fontLoads.get(family)!;
}

/** Registers a theme's fonts with the document; missing files fall back with a warning. */
export async function loadThemeFonts(theme: Theme): Promise<{ ok: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  let ok = true;
  for (const family of new Set(Object.values(theme.fonts))) {
    if (!(await ensureFont(family))) {
      ok = false;
      warnings.push(`Font "${family}" (${fontSlug(family)}) failed to load; using a fallback font.`);
    }
  }
  return { ok, warnings };
}

export async function loadAssets(theme: Theme, iso2s: string[], fakes: { iso2: string; hue: number }[] = [], imageIds: string[] = [], shapeIso2s: string[] = []): Promise<Assets> {
  const { ok: fontsOk, warnings } = await loadThemeFonts(theme);
  const flags = new Map<string, ImageBitmap>();
  await Promise.all([...new Set(iso2s)].map(async (i) => flags.set(i, await rasterFlag(i))));
  for (const f of fakes) { const real = flags.get(f.iso2); if (real) flags.set(fakeKey(f.iso2), await fakeFlag(real, f.hue)); }
  const images = new Map<string, ImageBitmap>();
  await Promise.all([...new Set(imageIds)].map(async (id) => {
    const res = await fetch(photoPath(id));
    if (!res.ok) throw new AssetError(`landmark photo ${id} failed to load (${res.status})`);
    images.set(id, await createImageBitmap(await res.blob()));
  }));
  const shapes = new Map<string, { path: Path2D; w: number; h: number }>();
  if (shapeIso2s.length) {
    const all = await (shapeFile ??= fetch("/shapes.json").then((r) => { if (!r.ok) throw new AssetError(`shapes.json failed to load (${r.status})`); return r.json(); }));
    for (const i of new Set(shapeIso2s)) {
      const s = all[i];
      if (!s) throw new AssetError(`no outline for ${i}`);
      shapes.set(i, { path: new Path2D(s.d), w: s.w, h: s.h });
    }
  }
  return { flags, images, shapes, fontsOk, warnings };
}

/** Decodes an image file and cover-fits it to the 1080x1920 frame. */
export async function loadBackground(file: Blob): Promise<ImageBitmap> {
  const src = await createImageBitmap(file);
  try {
    const c = new OffscreenCanvas(1080, 1920);
    const k = Math.max(1080 / src.width, 1920 / src.height);
    const w = src.width * k, h = src.height * k;
    c.getContext("2d")!.drawImage(src, (1080 - w) / 2, (1920 - h) / 2, w, h);
    return await createImageBitmap(c);
  } finally {
    src.close();
  }
}
