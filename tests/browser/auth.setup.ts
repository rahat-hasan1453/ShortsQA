import { expect, test as setup } from "@playwright/test";

/** Logs in once with the test PIN and stores the session for every other spec. */
setup("log in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("PIN").fill("111111");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: "tests/browser/.auth.json" });
});
