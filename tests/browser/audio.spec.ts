import { expect, test } from "@playwright/test";

test("mixed audio: right length, no NaN, healthy peak, voice audible, music ducked under voice", async ({ page }) => {
  await page.goto("/debug/frame?theme=retro-arcade&seed=demo");
  await page.getByTestId("ready").filter({ hasText: "ready" }).waitFor({ timeout: 60000 });
  for (const theme of ["retro-arcade", "gold-luxury", "candy-pop"]) {
    const s = await page.evaluate((t) => (window as any).__debug.audioStats(t, "demo"), theme);
    expect(s.rate).toBe(48000);
    expect(s.channels).toBe(2);
    expect(s.length, theme).toBe(Math.ceil(s.duration * 48000));
    expect(s.nan, theme).toBe(false);
    expect(s.peak, theme).toBeGreaterThan(0.05);
    expect(s.peak, theme).toBeLessThan(0.98);
    expect(s.voiceFull, theme).toBeGreaterThan(s.voiceMuted * 1.5);
    expect(s.gapCount, theme).toBeGreaterThan(3);
    expect(s.duckRatio, `${theme} duck ratio`).toBeLessThan(0.7);
  }
});
