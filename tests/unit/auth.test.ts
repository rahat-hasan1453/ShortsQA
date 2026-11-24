import { expect, test } from "vitest";
import { createLoginLimiter, pinMatches, SESSION_TTL_MS, signSession, verifySession } from "../../src/lib/auth";

test("signed session verifies until it expires", async () => {
  const t = await signSession("s", 1000);
  expect(await verifySession(t, "s", 1000 + SESSION_TTL_MS - 1)).toBe(true);
  expect(await verifySession(t, "s", 1000 + SESSION_TTL_MS)).toBe(false);
});

test("wrong secret, tampered expiry, garbage and undefined are rejected", async () => {
  const t = await signSession("s", 1000);
  const [exp, mac] = t.split(".");
  expect(await verifySession(t, "other", 1000)).toBe(false);
  expect(await verifySession(`${Number(exp) + 1}.${mac}`, "s", 1000)).toBe(false);
  for (const bad of [undefined, "", "abc", "1.2.3", "x.y"]) expect(await verifySession(bad, "s", 1000)).toBe(false);
});

test("pinMatches is exact after trimming", () => {
  expect(pinMatches(" 123456 ", "123456")).toBe(true);
  expect(pinMatches("123457", "123456")).toBe(false);
  expect(pinMatches("", "123456")).toBe(false);
});

test("5 failures in 10 minutes block for 10 minutes, even for a correct PIN", () => {
  const l = createLoginLimiter();
  for (let i = 0; i < 5; i++) { expect(l.check("ip", i).allowed).toBe(true); l.fail("ip", i); }
  expect(l.check("ip", 10)).toEqual({ allowed: false, retryAfterMs: 600000 - 6 });
  expect(l.check("ip", 4 + 600000).allowed).toBe(true);
  expect(l.check("other", 10).allowed).toBe(true);
});

test("failures older than the window do not count", () => {
  const l = createLoginLimiter();
  for (let i = 0; i < 4; i++) l.fail("ip", 0);
  l.fail("ip", 600001);
  expect(l.check("ip", 600002).allowed).toBe(true);
});
