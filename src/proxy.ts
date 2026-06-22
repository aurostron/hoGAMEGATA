import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/waitlist",
  "/api/waitlist/join",
  "/api/auth/token-login",
  "/api/games/summary",
  "/api/stats",
  "/login",
  "/auth/callback"
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public paths without authentication
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + "/"))) {
    return NextResponse.next();
  }

  // 2. Check for authentication cookies
  const cookies = request.cookies.getAll();
  const hasSupabaseCookie = cookies.some(
    cookie => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token")
  );
  const hasMockCookie = request.cookies.has("gamegata-session");

  const isAuthenticated = hasSupabaseCookie || hasMockCookie;

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized. Early access only." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/waitlist";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
