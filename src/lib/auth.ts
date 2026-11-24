/** PIN login: HMAC-signed session tokens and a per-IP lockout. Web Crypto only, so it runs in the proxy and in route handlers. */

export const SESSION_COOKIE = "sqa_session";
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Compares in time independent of where the strings differ. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns "<expiresAtMs>.<base64url hmac>". */
export async function signSession(secret: string, now: number): Promise<string> {
  const exp = String(now + SESSION_TTL_MS);
  return `${exp}.${await mac(secret, exp)}`;
}

export async function verifySession(token: string | undefined, secret: string, now: number): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  if (!sameString(await mac(secret, parts[0]), parts[1])) return false;
  return now < Number(parts[0]);
}

export function pinMatches(input: string, pin: string): boolean {
  const a = input.trim();
  return a.length > 0 && pin.length > 0 && sameString(a, pin);
}

export interface LoginLimiter {
  check(ip: string, now: number): { allowed: boolean; retryAfterMs: number };
  fail(ip: string, now: number): void;
  reset(ip: string): void;
}

/** `max` failures within `windowMs` block the IP for `blockMs` from the last of them. */
export function createLoginLimiter(opts: { max?: number; windowMs?: number; blockMs?: number } = {}): LoginLimiter {
  const { max = 5, windowMs = 600_000, blockMs = 600_000 } = opts;
  const fails = new Map<string, number[]>();
  const blockedUntil = new Map<string, number>();
  return {
    check(ip, now) {
      const until = blockedUntil.get(ip) ?? 0;
      if (now < until) return { allowed: false, retryAfterMs: until - now };
      return { allowed: true, retryAfterMs: 0 };
    },
    fail(ip, now) {
      const recent = (fails.get(ip) ?? []).filter((t) => now - t <= windowMs);
      recent.push(now);
      if (recent.length >= max) { blockedUntil.set(ip, now + blockMs); fails.delete(ip); }
      else fails.set(ip, recent);
    },
    reset(ip) { fails.delete(ip); blockedUntil.delete(ip); },
  };
}
