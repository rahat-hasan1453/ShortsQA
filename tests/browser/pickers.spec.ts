import { expect, test } from "@playwright/test";

test("voice picker lists the registry and switching voice re-prepares the quiz from that voice's folder", async ({ page }) => {
  await page.goto("/?seed=demo");
  const group = page.getByRole("group", { name: "Voice" });
  await expect(group.getByRole("button", { pressed: true })).toContainText("Heart");
  for (const name of ["Bella", "Michael", "Adam", "Emma", "Chatterbox"]) await expect(group.getByText(name, { exact: false }).first()).toBeVisible();
  await group.getByRole("button", { name: /^Bella/ }).click();
  await expect(group.getByRole("button", { pressed: true })).toContainText("Bella");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).some((n) => n.includes("/audio/af_bella/manifest.json")))).toBe(true);
});

test("a voice without clips is disabled, and ?voice= to it falls back with a warning", async ({ page }) => {
  await page.route("**/audio/chatterbox/manifest.json", (r) => r.fulfill({ status: 404 }));
  await page.goto("/?seed=demo&voice=chatterbox");
  await expect(page.getByText('Voice "chatterbox" has no clips yet; using Heart.')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: /^Chatterbox/ })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
});

test("gallery shows Random + 21 template cards, filters, and picking one changes the template", async ({ page }) => {
  await page.goto("/?seed=demo");
  const g = page.getByRole("group", { name: "Template" });
  await expect(g.locator("[data-theme-card]")).toHaveCount(22);
  await g.getByRole("button", { name: "Popular", exact: true }).click();
  await expect(g.locator("[data-theme-card]")).toHaveCount(6);
  await g.getByRole("button", { name: /Game Show/ }).click();
  await expect(page.getByText("template: Game Show")).toBeVisible({ timeout: 60000 });
  await expect(g.getByRole("button", { name: /Game Show/ })).toHaveAttribute("aria-pressed", "true");
});

test("template thumbnails render", async ({ page }) => {
  await page.goto("/?seed=demo");
  const thumb = page.locator('[data-theme-card="arctic-ice"] img');
  await expect(thumb).toBeVisible({ timeout: 60000 });
  expect(await thumb.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(216);
});

test("rapid template clicks end on the last choice", async ({ page }) => {
  await page.goto("/?seed=demo");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  const g = page.getByRole("group", { name: "Template" });
  for (const n of [/Neon Night/, /Arctic Ice/, /Mono Bold/]) await g.getByRole("button", { name: n }).click();
  await expect(page.getByText("template: Mono Bold")).toBeVisible({ timeout: 60000 });
});

test("font search filters and each row is drawn in its own font", async ({ page }) => {
  await page.goto("/?seed=demo");
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  await page.getByRole("button", { name: /^Font:/ }).click();
  const box = page.getByLabel("Search fonts");
  await expect(box).toBeFocused();
  await expect(page.getByRole("option", { name: "Template default" })).toBeVisible();
  await box.fill("bebas");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1); // the page also has <select> options
  const row = page.getByRole("option", { name: "Bebas Neue" });
  expect(await row.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("Bebas Neue");
  await row.click();
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(page.getByRole("button", { name: "Font: Bebas Neue" })).toBeVisible();
});

test("font popover closes on Escape and lists the groups", async ({ page }) => {
  await page.goto("/?seed=demo");
  await page.getByRole("button", { name: /^Font:/ }).click();
  for (const g of ["Display", "Sans", "Serif", "Handwritten", "Mono"]) await expect(page.getByRole("group", { name: g })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
});
