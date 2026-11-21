import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/** Everything except the login page, the login API and Next's own static chunks needs a valid session cookie. */
export async function proxy(request: NextRequest) {
  const secret = process.env.STUDIO_SECRET ?? "";
  const ok = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret, Date.now());
  if (ok) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (pathname.startsWith("/audio/") || /\.\w+$/.test(pathname)) return new NextResponse("Not signed in", { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login).*)"],
};
