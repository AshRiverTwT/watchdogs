import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "wd_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PROTECTED = ["/alerts", "/settings", "/admin"];

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = req.nextUrl;

  if (!token && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Rolling cookie expiry. The real check (and DB-side extension) happens on the server.
  if (token && req.method === "GET") {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(Date.now() + TTL_MS),
    });
  }
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
