import { NextResponse, type NextRequest } from "next/server";
import { createLoginLimiter, pinMatches, SESSION_COOKIE, SESSION_TTL_MS, signSession } from "@/lib/auth";

const limiter = createLoginLimiter();
// x-forwarded-for is whatever the client sends (Next keeps a client-supplied value), so a per-IP limit alone can be
// dodged by rotating it. A cap on failures from everyone together stops brute force: 20 in 10 minutes locks all logins.
const everyone = createLoginLimiter({ max: 20 });
const ALL = "*";

export async function POST(request: NextRequest) {
  const pin = process.env.STUDIO_PIN ?? "";
  const secret = process.env.STUDIO_SECRET ?? "";
  if (!pin || !secret) return NextResponse.json({ error: "Server PIN not configured" }, { status: 500 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const all = everyone.check(ALL, now), mine = limiter.check(ip, now);
  const gate = all.allowed ? mine : all;
  if (!gate.allowed) {
    const mins = Math.ceil(gate.retryAfterMs / 60_000);
    return NextResponse.json({ error: `Too many tries. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, retryAfterMs: gate.retryAfterMs }, { status: 429 });
  }

  let input = "";
  try { input = String((await request.json())?.pin ?? ""); } catch { /* empty or bad body counts as a wrong PIN */ }
  if (!pinMatches(input, pin)) {
    limiter.fail(ip, now);
    everyone.fail(ALL, now);
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  limiter.reset(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(secret, now), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS / 1000, secure: request.nextUrl.protocol === "https:",
  });
  return res;
}
