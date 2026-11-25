import { expect, test } from "@playwright/test";

const url = (q: string) => `/debug/frame?${q}`;
const waitReady = async (page: any) => { await page.getByTestId("ready").filter({ hasText: "ready" }).waitFor({ timeout: 60000 }); };
const TIMES = ["hook:1", "timer:0:1.0", "reveal:0:0.8", "timer:9:1.5", "outro:1"];

test.describe("golden frames", () => {
  for (const theme of ["arctic-ice", "retro-arcade", "quiz-burst", "dark-alert", "game-show", "clean-white", "sticker-pop", "mono-bold"]) {
    for (const at of TIMES) {
      test(`${theme} ${at}`, async ({ page }) => {
        await page.goto(url(`theme=${theme}&seed=demo&at=${at}`));
        await waitReady(page);
        await expect(page.locator("canvas")).toHaveScreenshot(`${theme}-${at.replace(/:/g, "_")}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});

test("safe-zone margins stay empty in all 21 themes", async ({ page }) => {
  await page.goto(url("theme=arctic-ice&seed=demo"));
  await waitReady(page);
  const themes: string[] = await page.evaluate(() => (window as any).__debug.themes);
  expect(themes).toHaveLength(21);
  for (const theme of themes) {
    for (const at of ["timer:0:1.0", "reveal:4:0.8", "timer:9:1.5", "diffUp:3:0.3", "diffUp:6:0.3", "diffUp:9:0.3", "outro:1"]) {
      const diff = await page.evaluate(([t, a]) => (window as any).__debug.marginDiff(t, "demo", a), [theme, at]);
      expect(diff, `${theme} ${at}`).toBe(0);
    }
  }
});

test("the longest country names fit the card in every theme", async ({ page }) => {
  await page.goto(url("theme=arctic-ice&seed=demo"));
  await waitReady(page);
  const out = await page.evaluate(async () => {
    const d = (window as any).__debug;
    const names: string[] = [...d.names].sort((a: string, b: string) => b.length - a.length).slice(0, 3);
    const res: { theme: string; name: string; width: number }[] = [];
    for (const theme of d.themes) for (const name of names) res.push({ theme, name, width: (await d.revealLayout(theme, name)).width });
    return res;
  });
  expect(out).toHaveLength(63);
  for (const r of out) expect(r.width, `${r.theme} ${r.name}`).toBeLessThanOrEqual(800);
});

test("rendering the same time twice is pixel-identical", async ({ page }) => {
  await page.goto(url("theme=neon-night&seed=demo&at=timer:2:1.2"));
  await waitReady(page);
  const a = await page.evaluate(() => (window as any).__debug.dataUrl());
  await page.evaluate(() => (window as any).__debug.render("neon-night", "demo", "timer:2:1.2"));
  const b = await page.evaluate(() => (window as any).__debug.dataUrl());
  expect(a).toBe(b);
});

test("a font that 404s falls back and shows a warning instead of throwing", async ({ page }) => {
  await page.route("**/fonts/**", (r) => r.abort());
  await page.goto(url("theme=arctic-ice&seed=demo&at=timer:0:1.0"));
  await waitReady(page);
  await expect(page.getByTestId("warnings")).toContainText("failed to load");
  await expect(page.locator("canvas")).toBeVisible();
});

test("safe-zone margins stay empty in the options and list styles", async ({ page }) => {
  await page.goto(url("theme=arctic-ice&seed=demo"));
  await waitReady(page);
  for (const style of ["options", "list"]) {
    for (const theme of ["quiz-burst", "dark-alert", "game-show", "sticker-pop", "mono-bold", "retro-arcade"]) {
      for (const at of ["timer:0:1.0", "reveal:4:0.8", "timer:9:1.5", "diffUp:3:0.3", "diffUp:6:0.3", "diffUp:9:0.3", "outro:1"]) {
        const diff = await page.evaluate(([t, a, st]) => (window as any).__debug.marginDiff(t, "demo", a, st), [theme, at, style]);
        expect(diff, `${style} ${theme} ${at}`).toBe(0);
      }
    }
  }
});

test("safe-zone margins stay empty for every flag size, shape and timer in all answer styles", async ({ page }) => {
  await page.goto(url("theme=arctic-ice&seed=demo"));
  await waitReady(page);
  const looks = [];
  for (const flagSize of ["small", "medium", "large", "xlarge"]) for (const flagShape of ["rounded", "sharp", "circle", "square"]) for (const timer of ["auto", "ring", "bar"]) looks.push({ flagSize, flagShape, timer });
  for (const flagBorder of [true, false]) for (const textOutline of [true, false]) for (const flagShape of ["rounded", "circle"]) looks.push({ flagSize: "xlarge", flagShape, timer: "auto", flagBorder, textOutline });
  for (const style of ["open", "options", "list"]) {
    for (const look of looks) {
      for (const at of ["timer:0:1.0", "timer:9:1.5", "reveal:4:0.8", "diffUp:3:0.3"]) {
        const diff = await page.evaluate(([t, a, st, lk]) => (window as any).__debug.marginDiff(t, "demo", a, st, lk), ["quiz-burst", at, style, look]);
        expect(diff, `${style} ${JSON.stringify(look)} ${at}`).toBe(0);
      }
    }
  }
});

test("the new looks draw: circle and sharp cards differ from the default frame", async ({ page }) => {
  await page.goto(url("theme=quiz-burst&seed=demo"));
  await waitReady(page);
  const shot = async (look: object | undefined, style = "list") => {
    await page.evaluate(([st, lk]) => (window as any).__debug.render("quiz-burst", "demo", "timer:2:1.5", st, lk), [style, look]);
    return page.evaluate(() => (window as any).__debug.dataUrl());
  };
  const noBorder = await shot({ flagSize: "large", flagShape: "rounded", timer: "auto", flagBorder: false, textOutline: true }), noOutline = await shot({ flagSize: "large", flagShape: "rounded", timer: "auto", flagBorder: true, textOutline: false }), xl = await shot({ flagSize: "xlarge", flagShape: "rounded", timer: "auto" });
  const base = await shot(undefined), circle = await shot({ flagSize: "large", flagShape: "circle", timer: "auto" }), bar = await shot({ flagSize: "large", flagShape: "rounded", timer: "bar" }), small = await shot({ flagSize: "small", flagShape: "rounded", timer: "auto" });
  expect(new Set([base, circle, bar, small, noBorder, noOutline, xl]).size).toBe(7);
});
