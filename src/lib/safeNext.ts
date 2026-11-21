/** The post-login target: kept only if it resolves to this same site, else "/" (blocks "//x", "/\x", tab tricks and absolute URLs). */
export function safeNext(raw: string | null, origin: string): string {
  if (!raw || !raw.startsWith("/") || /[\\\u0000-\u001f]/.test(raw)) return "/";
  try {
    const u = new URL(raw, origin);
    return u.origin === new URL(origin).origin ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}
