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
