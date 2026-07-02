import { defineMiddleware } from "astro:middleware";

const PUBLIC_PATHS = [
  "/sitemap.xml",
  "/robots.txt",
  "/waitlist",
  "/api/waitlist/join",
  "/api/auth/token-login",
  "/api/auth/dev-bypass",
  "/api/games/summary",
  "/api/stats",
  "/login",
  "/auth/callback",
  "/privacy",
  "/legal"
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;
  const { pathname } = url;

  // 1. Skip static assets, metadata, images, and other assets
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|css|js|woff2|woff|ttf|ico)$/i)
  ) {
    return next();
  }

  // 2. Allow public paths without authentication
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + "/"))) {
    return next();
  }

  // 3. Check for authentication cookies
  const rawCookie = context.request.headers.get("cookie") || "";
  
  // Check for mock session: gamegata-session
  const hasMockCookie = cookies.has("gamegata-session");

  // Check for Supabase session cookie: starts with sb- and ends with -auth-token
  const hasSupabaseCookie = rawCookie.split(";").some(cookieStr => {
    const trimmed = cookieStr.trim();
    return trimmed.startsWith("sb-") && trimmed.includes("-auth-token");
  });

  const isAuthenticated = hasSupabaseCookie || hasMockCookie;

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Early access only." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    return redirect("/waitlist");
  }

  return next();
});
