import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.setTimeout(600_000);

async function open(page: any) {
  await page.goto("/debug/frame?theme=retro-arcade&seed=demo");
  await page.getByTestId("ready").filter({ hasText: "ready" }).waitFor({ timeout: 60000 });
}

test("export is a valid 1080x1920 H.264/AAC MP4 <= 59 s; a second concurrent export is rejected; abort frees the encoder", async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => (window as any).__debug.exportConcurrent("retro-arcade", "demo"));
  expect(r.secondError).toBe("ExportBusyError");
  const file = path.join(os.tmpdir(), `shorts-export-${Date.now()}.mp4`);
  fs.writeFileSync(file, Buffer.from(r.firstBase64, "base64"));
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString());
  const v = probe.streams.find((s: any) => s.codec_type === "video");
  const a = probe.streams.find((s: any) => s.codec_type === "audio");
  expect(v.width).toBe(1080);
  expect(v.height).toBe(1920);
  expect(v.codec_name).toBe("h264");
  expect(a.codec_name).toBe("aac");
  expect(Number(probe.format.duration)).toBeLessThanOrEqual(59);
  expect(Number(probe.format.duration)).toBeGreaterThan(40);
  expect(eval(v.r_frame_rate)).toBeCloseTo(30, 0);
  const again = await page.evaluate(() => (window as any).__debug.exportAbortThenRetry("retro-arcade", "demo"));
  expect(again.abortError).toBe("AbortError");
  expect(again.retryBytes).toBeGreaterThan(500_000);
});

test("a 61 s timeline is rejected with DurationError before any frame is drawn", async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => (window as any).__debug.exportBad("retro-arcade", "demo", "duration"));
  expect(r.error).toBe("DurationError");
  expect(r.framesDrawn).toBe(0);
});

test("a missing flag bitmap is rejected with AssetError", async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => (window as any).__debug.exportBad("retro-arcade", "demo", "asset"));
  expect(r.error).toBe("AssetError");
});
