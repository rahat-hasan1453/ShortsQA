import { expect, test } from "@playwright/test";

test("theme switch toggles light/dark and is remembered after reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?seed=demo");
  const html = page.locator("html");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  const darkBg = await page.evaluate(() => getComputedStyle(document.querySelector(".studio-panel")!).backgroundColor);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  const lightBg = await page.evaluate(() => getComputedStyle(document.querySelector(".studio-panel")!).backgroundColor);
  expect(lightBg).not.toBe(darkBg);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});

test("shape switch above the preview: Shorts 9:16 is on, Long 16:9 is shown but not ready yet", async ({ page }) => {
  await page.goto("/?seed=demo");
  const shapes = page.getByRole("radiogroup", { name: "Video shape" });
  const shorts = shapes.getByRole("radio", { name: /Shorts/ });
  const long = shapes.getByRole("radio", { name: /Long/ });
  await expect(shorts).toHaveAttribute("aria-checked", "true");
  await expect(long).toHaveAttribute("aria-disabled", "true");
  await expect(long).toContainText("16:9");
  const sw = (await shapes.boundingBox())!, canvas = (await page.locator("canvas").boundingBox())!;
  expect(sw.y + sw.height).toBeLessThanOrEqual(canvas.y);
});
