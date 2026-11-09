import fs from "node:fs";
import { expect, test } from "@playwright/test";

test.setTimeout(300_000);

test("page loads with a visible canvas and the first flag shows", async ({ page }) => {
  await page.goto("/?seed=demo&theme=retro-arcade");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
});

test("export downloads flags-part1-demo.mp4 (> 500 KB) and a .txt with #shorts", async ({ page }) => {
  await page.goto("/?seed=demo&theme=retro-arcade");
  await expect(page.getByRole("button", { name: "Export MP4" })).toBeEnabled({ timeout: 60000 });
  const downloads: any[] = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: "Export MP4" }).click();
  await expect.poll(() => downloads.length, { timeout: 240000 }).toBe(2);
  const byName = Object.fromEntries(downloads.map((d) => [d.suggestedFilename(), d]));
  expect(Object.keys(byName).sort()).toEqual(["flags-part1-demo.mp4", "flags-part1-demo.txt"]);
  const mp4 = await byName["flags-part1-demo.mp4"].path();
  expect(fs.statSync(mp4).size).toBeGreaterThan(500_000);
  expect(fs.readFileSync(await byName["flags-part1-demo.txt"].path(), "utf8")).toContain("#shorts");
});

test("Cancel during export leaves Export clickable again", async ({ page }) => {
  await page.goto("/?seed=cancel&theme=arctic-ice");
  const exportBtn = page.getByRole("button", { name: "Export MP4" });
  await expect(exportBtn).toBeEnabled({ timeout: 60000 });
  await exportBtn.click();
  const cancel = page.getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(exportBtn).toBeEnabled({ timeout: 30000 });
});

test("without VideoEncoder the page says Open in Chrome or Edge and Export is disabled", async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).VideoEncoder; });
  await page.goto("/?seed=demo");
  await expect(page.getByText("Open in Chrome or Edge")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Export MP4" })).toBeDisabled();
});

test("the seed fixes the first flag: same seed same flag across reloads, other seed another flag", async ({ page }) => {
  const first = async (q: string) => {
    await page.goto(`/?${q}`);
    await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
    return page.getByTestId("first-country").innerText();
  };
  const a1 = await first("seed=alpha");
  const a2 = await first("seed=alpha");
  const b = await first("seed=beta");
  expect(a1).toBe(a2);
  expect(b).not.toBe(a1);
});

function solidPng(r: number, g: number, b: number): Buffer {
  const zlib = require("node:zlib");
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const w = 4, h = 4;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const pixel = (page: any, x: number, y: number) => page.evaluate(([px, py]: number[]) => {
  const c = document.querySelector("canvas") as HTMLCanvasElement;
  return Array.from(c.getContext("2d")!.getImageData(px, py, 1, 1).data);
}, [x, y]);

test("a chosen background image fills the frame; Clear background restores the theme", async ({ page }) => {
  await page.goto("/?seed=demo&theme=arctic-ice");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  await page.waitForTimeout(500);
  const before = await pixel(page, 10, 10);
  await page.getByLabel("Background image").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: solidPng(255, 0, 0) });
  await expect.poll(async () => (await pixel(page, 10, 10))[0] > 180 && (await pixel(page, 10, 10))[1] < 150, { timeout: 15000 }).toBe(true);
  await page.getByRole("button", { name: "Clear background" }).click();
  await expect.poll(async () => { const now = await pixel(page, 10, 10); return now.every((v: number, i: number) => Math.abs(v - before[i]) <= 3); }, { timeout: 15000 }).toBe(true);
});

test("choosing a font changes how the frame is drawn and reports no font warning", async ({ page }) => {
  await page.goto("/?seed=demo&theme=arctic-ice");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  await page.waitForTimeout(500);
  const url = () => page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement).toDataURL());
  const before = await url();
  await page.getByLabel("Font").selectOption("Press Start 2P");
  await expect.poll(async () => (await url()) !== before, { timeout: 20000 }).toBe(true);
  await expect(page.getByText("failed to load")).toHaveCount(0);
});

test("simple layout: 3 numbered steps, format cards (only Flags ready), advanced options hidden by default", async ({ page }) => {
  await page.goto("/?seed=demo&theme=arctic-ice");
  await expect(page.getByRole("heading", { name: "1. Choose a quiz type" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("heading", { name: "2. Pick a style" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "3. Make the video" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Flags/ })).toHaveAttribute("aria-pressed", "true");
  for (const name of ["Capitals", "Landmarks", "What is it?", "Real or Fake flag", "Country shape", "Math", "Missing letters"]) {
    const card = page.getByRole("button", { name: new RegExp(`^${name.replace("?", "\\?")}`) });
    await expect(card).toBeDisabled();
    await expect(card).toContainText("Coming soon");
  }
  const adv = page.locator("details", { hasText: "Advanced" });
  await expect(adv).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Seed")).toBeHidden();
  await adv.locator("summary").click();
  await expect(page.getByLabel("Seed")).toBeVisible();
});
