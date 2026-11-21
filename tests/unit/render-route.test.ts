import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, expect, test } from "vitest";

let dir = "";
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "render-")); process.env.STUDIO_OUTPUT_DIR = dir; });

const call = async (method: "POST" | "GET", id: string, query = "", body?: Uint8Array) => {
  const mod = await import("../../src/app/api/render/[id]/route");
  const req = new NextRequest(`http://localhost/api/render/${id}${query}`, { method, ...(body ? { body: Buffer.from(body) } : {}) });
  return (mod as any)[method](req, { params: Promise.resolve({ id }) }) as Promise<Response>;
};

test("chunks land at their positions (out of order), done renames, then GET serves the file", async () => {
  expect((await call("POST", "long-1", "?pos=3", new Uint8Array([4, 5]))).status).toBe(200);
  expect((await call("POST", "long-1", "?pos=0", new Uint8Array([1, 2, 3]))).status).toBe(200);
  expect((await call("GET", "long-1")).status).toBe(404); // only a .part exists so far
  expect((await call("POST", "long-1", "?done=1")).status).toBe(200);
  expect([...fs.readFileSync(path.join(dir, "long-1.mp4"))]).toEqual([1, 2, 3, 4, 5]);
  expect(fs.existsSync(path.join(dir, "long-1.mp4.part"))).toBe(false);
  const res = await call("GET", "long-1");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-disposition")).toContain('attachment; filename="long-1.mp4"');
  expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3, 4, 5]);
});

test("thumbnail is saved next to the video", async () => {
  expect((await call("POST", "long-2", "?thumb=1", new Uint8Array([9, 9]))).status).toBe(200);
  expect([...fs.readFileSync(path.join(dir, "long-2.jpg"))]).toEqual([9, 9]);
});

test("a fresh start (pos=0&reset=1) drops a stale partial file", async () => {
  await call("POST", "long-3", "?pos=0", new Uint8Array([7, 7, 7, 7]));
  await call("POST", "long-3", "?pos=0&reset=1", new Uint8Array([1]));
  await call("POST", "long-3", "?done=1");
  expect([...fs.readFileSync(path.join(dir, "long-3.mp4"))]).toEqual([1]);
});

test("bad ids are refused", async () => {
  for (const id of ["../x", "A B", "x".repeat(81), ""]) expect((await call("POST", id, "?pos=0", new Uint8Array([1]))).status).toBe(400);
});

test("a chunk cut short on the way (body smaller than its declared length) is refused, not written", async () => {
  const mod = await import("../../src/app/api/render/[id]/route");
  const req = new NextRequest("http://localhost/api/render/long-4?pos=0", { method: "POST", body: Buffer.from([1, 2, 3]), headers: { "x-chunk-length": "5" } });
  const res = await (mod as any).POST(req, { params: Promise.resolve({ id: "long-4" }) });
  expect(res.status).toBe(413);
  expect(fs.existsSync(path.join(dir, "long-4.mp4.part"))).toBe(false);
});

test("starting a new export of the same id keeps the finished video until the new one is done", async () => {
  await call("POST", "long-5", "?pos=0", new Uint8Array([1, 1]));
  await call("POST", "long-5", "?done=1");
  await call("POST", "long-5", "?pos=0&reset=1", new Uint8Array([2])); // new attempt, then cancelled
  expect([...fs.readFileSync(path.join(dir, "long-5.mp4"))]).toEqual([1, 1]);
});
