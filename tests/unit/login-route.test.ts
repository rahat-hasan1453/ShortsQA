import { NextRequest } from "next/server";
import { beforeAll, expect, test } from "vitest";

beforeAll(() => { process.env.STUDIO_PIN = "111111"; process.env.STUDIO_SECRET = "s"; });

const post = async (pin: string, ip: string) => {
  const { POST } = await import("../../src/app/api/login/route");
  return POST(new NextRequest("http://localhost/api/login", { method: "POST", body: JSON.stringify({ pin }), headers: { "content-type": "application/json", "x-forwarded-for": ip } }));
};

test("rotating a forged x-forwarded-for cannot brute-force the PIN", async () => {
  for (let i = 0; i < 20; i++) expect((await post("000000", `10.0.0.${i}`)).status).toBe(401);
  const r = await post("111111", "10.0.0.99");
  expect(r.status).toBe(429);
  expect((await r.json()).error).toMatch(/Try again in 10 minutes/);
});
