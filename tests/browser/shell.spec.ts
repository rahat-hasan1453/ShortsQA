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

test("shape switch: Long makes a 16:9 quiz (no answer-style choice, wide thumbnails) and Shorts restores 9:16", async ({ page }) => {
  await page.goto("/?seed=demo");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  const shapes = page.getByRole("radiogroup", { name: "Video shape" });
  const sw = (await shapes.boundingBox())!, c0 = (await page.locator("canvas").boundingBox())!;
  expect(sw.y + sw.height).toBeLessThanOrEqual(c0.y);
  await expect(shapes.getByRole("radio", { name: /Shorts/ })).toHaveAttribute("aria-checked", "true");

  await shapes.getByRole("radio", { name: /Long/ }).click();
  await expect(shapes.getByRole("radio", { name: /Long/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => page.locator("canvas").evaluate((c: HTMLCanvasElement) => [c.width, c.height].join("x")), { timeout: 60000 }).toBe("1920x1080");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  await expect(page.getByLabel("Answer style")).toBeHidden();
  await expect(page.getByText("Long videos always use A–D options")).toBeVisible();
  await expect(page.locator('[data-theme-card="arctic-ice"] img')).toBeVisible({ timeout: 60000 });
  expect(await page.locator('[data-theme-card="arctic-ice"] img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(384);
  expect(page.url()).toContain("shape=long");

  await shapes.getByRole("radio", { name: /Shorts/ }).click();
  await expect.poll(() => page.locator("canvas").evaluate((c: HTMLCanvasElement) => [c.width, c.height].join("x")), { timeout: 60000 }).toBe("1080x1920");
  await expect(page.getByLabel("Answer style")).toBeVisible();
  await expect.poll(() => page.locator('[data-theme-card="arctic-ice"] img').evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 60000 }).toBe(216);
});

test("?shape=long opens straight into a long quiz", async ({ page }) => {
  await page.goto("/?seed=demo&shape=long");
  await expect(page.getByRole("radio", { name: /Long/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => page.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width), { timeout: 60000 }).toBe(1920);
});
