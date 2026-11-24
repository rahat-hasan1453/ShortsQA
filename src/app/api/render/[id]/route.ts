import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";

/** Rendered videos land in output/ (gitignored) so the upload agent can pick them up next to their metadata. */
const outDir = () => process.env.STUDIO_OUTPUT_DIR ?? path.join(process.cwd(), "output");
const ID = /^[a-z0-9-]{1,80}$/;
type Ctx = { params: Promise<{ id: string }> };

/**
 * POST ?pos=N (body = bytes)  writes at byte N of <id>.mp4.part (reset=1 starts a fresh file)
 * POST ?done=1                renames the finished .part to <id>.mp4
 * POST ?thumb=1 (body = jpg)  saves <id>.jpg
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!ID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const q = request.nextUrl.searchParams, dir = outDir();
  fs.mkdirSync(dir, { recursive: true });
  const part = path.join(dir, `${id}.mp4.part`);
  if (q.get("done")) {
    if (!fs.existsSync(part)) return NextResponse.json({ error: "nothing to finish" }, { status: 404 });
    fs.renameSync(part, path.join(dir, `${id}.mp4`));
    return NextResponse.json({ ok: true, file: `output/${id}.mp4` });
  }
  const body = Buffer.from(await request.arrayBuffer());
  // The sender states each chunk's size: a body cut short on the way (e.g. by a proxy size limit) must fail loudly, not leave a broken MP4.
  const declared = request.headers.get("x-chunk-length");
  if (declared !== null && Number(declared) !== body.length) return NextResponse.json({ error: `chunk arrived with ${body.length} of ${declared} bytes` }, { status: 413 });
  if (q.get("thumb")) { fs.writeFileSync(path.join(dir, `${id}.jpg`), body); return NextResponse.json({ ok: true }); }
  const pos = Number(q.get("pos"));
  if (!Number.isSafeInteger(pos) || pos < 0) return NextResponse.json({ error: "bad pos" }, { status: 400 });
  if (q.get("reset")) fs.rmSync(part, { force: true }); // a finished <id>.mp4 stays until "done" replaces it, so a cancelled re-export loses nothing
  const fd = fs.openSync(part, fs.existsSync(part) ? "r+" : "w");
  try { fs.writeSync(fd, body, 0, body.length, pos); } finally { fs.closeSync(fd); }
  return NextResponse.json({ ok: true });
}

/** Downloads a finished video. */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!ID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const file = path.join(outDir(), `${id}.mp4`);
  if (!fs.existsSync(file)) return NextResponse.json({ error: "not finished" }, { status: 404 });
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { "content-type": "video/mp4", "content-length": String(fs.statSync(file).size), "content-disposition": `attachment; filename="${id}.mp4"` } });
}
