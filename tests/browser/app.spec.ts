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
