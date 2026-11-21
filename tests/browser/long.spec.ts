import { expect, test } from "@playwright/test";

test.setTimeout(300_000);

for (const quiz of ["flags", "capitals", "landmarks", "what-is-it", "math"]) {
  test(`long ${quiz}: every scene draws inside the 16:9 frame`, async ({ page }) => {
    await page.goto("/debug/frame?seed=demo");
    await expect(page.getByTestId("ready")).toHaveText("ready", { timeout: 60000 });
    const r = await page.evaluate((q) => (window as any).__debug.longScenes(q, "demo"), quiz);
    expect(r.n).toBeGreaterThanOrEqual(24);
    for (const s of r.scenes) {
      expect(s.error, `${s.kind}: ${s.error}`).toBeUndefined();
      expect(s.outside, `${s.kind} content outside the frame margin`).toBe(0);
    }
    expect(r.scenes.map((s: any) => s.kind)).toEqual(expect.arrayContaining(["hook", "timer", "reveal", "score", "outro"]));
  });
}

test("a 7-minute long timeline is not rejected by the Shorts 59 s limit", async ({ page }) => {
  await page.goto("/debug/frame?seed=demo");
  await expect(page.getByTestId("ready")).toHaveText("ready", { timeout: 60000 });
  expect(await page.evaluate(() => (window as any).__debug.longNotRejected())).toBe("AbortError");
});

test("cancelling a long export leaves no finished file and Export works again", async ({ page }) => {
  await page.goto("/?seed=cancel-long&shape=long");
  const exportBtn = page.getByRole("button", { name: "Export MP4" });
  await expect(exportBtn).toBeEnabled({ timeout: 60000 });
  await exportBtn.click();
  await expect(page.locator("progress")).toBeVisible();
  await expect.poll(() => page.locator("progress").evaluate((p: HTMLProgressElement) => p.value), { timeout: 60000 }).toBeGreaterThan(0.005);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(exportBtn).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole("status")).toHaveText("Cancelled");
  expect((await page.request.get("/api/render/long-flags-part1-cancel-long")).status()).toBe(404);
});
