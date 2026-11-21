import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated visit redirects to /login", async ({ page }) => {
  await page.goto("/?seed=demo");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("API and static audio without a session are 401", async ({ request }) => {
  expect((await request.get("/audio/af_heart/manifest.json")).status()).toBe(401);
});

test("garbage cookie still lands on /login", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "sqa_session", value: "1.abc", url: baseURL! }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong PIN shows an error, right PIN opens the app at the requested page", async ({ page }) => {
  await page.goto("/?seed=demo");
  await page.getByLabel("PIN").fill("000000");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Wrong PIN"); // Next adds its own route-announcer alert
  await page.getByLabel("PIN").fill("111111");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/\?seed=demo/);
  await expect(page.locator("canvas")).toBeVisible();
});

test("lockout after 5 wrong PINs refuses the right PIN too", async ({ request }) => {
  const h = { "x-forwarded-for": "10.9.9.9" };
  for (let i = 0; i < 5; i++) expect((await request.post("/api/login", { data: { pin: "0" }, headers: h })).status()).toBe(401);
  const r = await request.post("/api/login", { data: { pin: "111111" }, headers: h });
  expect(r.status()).toBe(429);
  expect((await r.json()).error).toMatch(/Try again in 10 minutes/);
});
