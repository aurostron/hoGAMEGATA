import "./lib/polyfill";
import { defineMiddleware } from "astro:middleware";
import { getServerUser, isAdminUser } from "./lib/serverAuth";
import { initTursoForRequest } from "./lib/turso";
import { initTursoAuthForRequest } from "./lib/tursoAuth";
import { initBetterAuth } from "./lib/auth";
import { env as cfEnv } from "cloudflare:workers";

const PUBLIC_PATHS = [
  "/",
  "/game",
  "/games",
  "/upcoming",
  "/re",
  "/api/games",
  "/api/search",
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/robots.txt",
  "/waitlist",
  "/api/waitlist/join",
  "/api/auth/token-login",
  "/api/auth/dev-bypass",
  "/api/auth/logout",
  "/api/games/summary",
  "/api/stats",
  "/api/track",
  "/login",
  "/auth/callback",
  "/privacy",
  "/legal",
  "/maintenance",
  "/submit-game",
  "/api/maintenance",
  "/search",
  "/api/edits",
  "/api/user/reputation",
  "/api/games/history",
  "/api/bugs/submit",
];


function applySecurityHeaders(res: Response): Response {
  try {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    return res;
  } catch {
    const newHeaders = new Headers(res.headers);
    newHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    newHeaders.set("X-Frame-Options", "DENY");
    newHeaders.set("X-Content-Type-Options", "nosniff");
    newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
    newHeaders.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  // Initialize Turso DB instances for the request isolate
  initTursoForRequest(runtimeEnv);
  initTursoAuthForRequest(runtimeEnv);

  const { url, redirect } = context;
  const { pathname } = url;

  // Redirect www to non-www canonical domain (e.g. www.gamegata.xyz -> gamegata.xyz)
  if (url.hostname.startsWith("www.")) {
    const canonicalHost = url.hostname.replace(/^www\./, "");
    return applySecurityHeaders(redirect(`https://${canonicalHost}${pathname}${url.search}`, 301));
  }

  // 1. Skip static assets
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|css|js|woff2|woff|ttf|ico)$/i)
  ) {
    return applySecurityHeaders(await next());
  }

  // 1.1. Instant 301 fast-redirect for /directory to GitHub Pages mirror
  if (pathname === "/directory" || pathname === "/directory/") {
    return applySecurityHeaders(redirect("https://project-hgg.github.io", 301));
  }

  // 1.5. Cloudflare Edge Cache MATCH check (0 DB reads for cached pages)
  const cache = !isDev && typeof caches !== "undefined" && (caches as any).default;
  const isCacheableGet = context.request.method === "GET" && (
    pathname.startsWith("/game/") || 
    pathname.startsWith("/api/games") || 
    pathname.startsWith("/api/search/suggest") ||
    pathname === "/about" ||
    pathname === "/upcoming" ||
    pathname.startsWith("/blog") ||
    pathname === "/sitemap.xml" ||
    pathname === "/sitemap-index.xml" ||
    pathname.startsWith("/api/image-proxy") ||
    pathname === "/api/stats"
  );

  const cleanUrl = new URL(context.request.url);
  // For image-proxy, search/suggest, and games catalog API, query params ARE unique identifiers — include them in the cache key
  const requiresQueryInCacheKey = pathname.startsWith("/api/image-proxy") || pathname.startsWith("/api/search/suggest") || pathname.startsWith("/api/games");
  const cacheKeyUrl = requiresQueryInCacheKey
    ? `${cleanUrl.origin}${cleanUrl.pathname}${cleanUrl.search}`
    : `${cleanUrl.origin}${cleanUrl.pathname}`;
  const cacheKey = isCacheableGet ? new Request(cacheKeyUrl, { method: "GET" }) : null;

  if (cache && isCacheableGet && cacheKey) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return applySecurityHeaders(cachedResponse);
      }
    } catch (e) {
      console.error("[Edge Cache Match Error]", e);
    }

    // One-time purge: delete old stale non-query entries
    if (pathname === "/api/image-proxy" || pathname === "/api/games") {
      try {
        const staleKey = new Request(`${cleanUrl.origin}${pathname}`, { method: "GET" });
        await cache.delete(staleKey);
      } catch {}
    }
  }

  // 2. Maintenance mode check via Cloudflare KV (0 DB reads)
  // Skip if already on the maintenance page or maintenance API to prevent redirect loops
  const isMaintenancePage = pathname === "/maintenance" || pathname.startsWith("/maintenance/");
  const isMaintenanceApi = pathname.startsWith("/api/maintenance");
  if (!isMaintenancePage && !isMaintenanceApi) {
    try {
      const kv = (runtimeEnv as any).MAINTENANCE as KVNamespace | undefined;
      if (kv) {
        const maintenanceStatus = await kv.get("status");
        if (maintenanceStatus === "on") {
          // Check for developer bypass cookie
          const bypassCookie = context.cookies.get("maintenance_bypass")?.value;
          const secret = (runtimeEnv as any).MAINTENANCE_SECRET;
          const hasBypass = bypassCookie && secret && bypassCookie === secret;
          if (!hasBypass) {
            // Use absolute URL redirect to avoid any relative-path confusion
            return applySecurityHeaders(redirect("https://gamegata.xyz/maintenance", 307));
          }
        }
      }
    } catch (err) {
      // Never crash the site due to a KV read failure
      console.error("[Maintenance] KV read failed:", err);
    }
  }

  // 4. Allow public paths without authentication
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    return applySecurityHeaders(await next());
  }

  // 5. Admin Panel & Admin API Gating — init auth clients only when needed
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    initTursoAuthForRequest(runtimeEnv);
    initBetterAuth(runtimeEnv);
    const user = await getServerUser(context.request, context.cookies);
    const isAdmin = user && isAdminUser(user.email, runtimeEnv);

    if (!isAdmin) {
      if (context.cookies.has("admin_2fa_session")) {
        context.cookies.delete("admin_2fa_session", { path: "/" });
      }
      if (pathname.startsWith("/admin/api/") || pathname.startsWith("/api/admin/")) {
        return applySecurityHeaders(new Response(
          JSON.stringify({ error: "Forbidden. Admin access required." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ));
      }
      return applySecurityHeaders(redirect("/login?error=unauthorized"));
    }

    // Enforce 2FA verification check for admin pages & APIs
    const is2FaPage = pathname === "/admin/verify-2fa";
    if (!is2FaPage) {
      const sessionToken = context.cookies.get("admin_2fa_session")?.value;
      let isVerified = false;

      if (sessionToken) {
        try {
          const { tursoAuth } = await import("./lib/tursoAuth");
          const { systemConfig } = await import("./db/auth-schema");
          const { eq } = await import("drizzle-orm");

          const [configRow] = await tursoAuth
            .select()
            .from(systemConfig)
            .where(eq(systemConfig.key, `admin_2fa_session:${user.email}`))
            .limit(1);

          if (configRow && configRow.value === sessionToken) {
            isVerified = true;
          }
        } catch (err) {
          console.error("[2FA Middleware Error] Failed to check session:", err);
        }
      }

      if (!isVerified) {
        if (pathname.startsWith("/admin/api/") || pathname.startsWith("/api/admin/")) {
          return applySecurityHeaders(new Response(
            JSON.stringify({ error: "Forbidden. 2FA verification required." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          ));
        }
        return applySecurityHeaders(redirect("/admin/verify-2fa"));
      }
    }
  }

  const response = await next();

  // Cloudflare Edge Cache PUT check
  if (cache && isCacheableGet && cacheKey && response.status === 200) {
    try {
      const cacheControl = response.headers.get("Cache-Control");
      if (cacheControl && cacheControl.includes("public")) {
        const responseToCache = response.clone();
        let cfCtx: any;
        try {
          cfCtx = (context.locals as any)?.cfContext;
        } catch {}
        if (cfCtx?.waitUntil) {
          cfCtx.waitUntil(cache.put(cacheKey, responseToCache));
        } else {
          await cache.put(cacheKey, responseToCache);
        }
      }
    } catch (e) {
      console.error("[Edge Cache Put Error]", e);
    }
  }

  return applySecurityHeaders(response);
});
