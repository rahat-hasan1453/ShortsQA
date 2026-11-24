import { expect, test } from "vitest";
import { safeNext } from "../../src/lib/safeNext";

const O = "http://localhost:3111";

test("same-site paths are kept", () => {
  expect(safeNext("/?seed=demo", O)).toBe("/?seed=demo");
  expect(safeNext("/tracker#x", O)).toBe("/tracker#x");
});

test("anything that leaves the site goes to /", () => {
  for (const bad of [null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "\\\\evil.com", "javascript:alert(1)"]) expect(safeNext(bad, O), String(bad)).toBe("/");
});
