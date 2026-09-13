import "./lib/polyfill";
import { defineMiddleware } from "astro:middleware";
import { getServerUser, isAdminUser } from "./lib/serverAuth";
import { initTursoForRequest } from "./lib/turso";
import { initTursoAuthForRequest } from "./lib/tursoAuth";
import { initBetterAuth } from "./lib/auth";
import { createRateLimitHtmlResponse } from "./lib/rateLimitHtml";
import { isIpBlocked, getClientIp, rateLimit } from "./lib/rateLimit";
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
  "/api/auth",
  "/api/user/check-limit",
  "/api/user/wishlist",
  "/api/games/summary",
  "/api/stats",
  "/api/track",
  "/login",
  "/auth/callback",
  "/privacy",
  "/legal",
  "/maintenance",
  "/submit-game",
  "/search",
  "/api/edits",
  "/api/user/reputation",
  "/api/games/history",
  "/api/bugs/submit",
  "/api/random",
  "/random",
];


function applySecurityHeaders(res: Response, reqOrigin?: string | null): Response {
  const isAllowed = reqOrigin && (
    reqOrigin.endsWith(".pages.dev") ||
    reqOrigin.endsWith(".gamegata.xyz") ||
    reqOrigin === "https://gamegata.xyz" ||
    reqOrigin === "https://project-hgg.github.io" ||
    reqOrigin.includes("localhost") ||
    reqOrigin.includes("127.0.0.1")
  );

  const headers = res.headers;
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (isAllowed) {
    headers.set("Access-Control-Allow-Origin", reqOrigin);
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  }
  return res;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  // Initialize Turso DB instances for the request isolate
  initTursoForRequest(runtimeEnv);
  initTursoAuthForRequest(runtimeEnv);

  const cfCtx = (context.locals as any)?.runtime?.ctx || (context.locals as any)?.cfContext;
  if (cfCtx && !(context.locals as any).cfContext) {
    (context.locals as any).cfContext = cfCtx;
  }

  const { url, redirect } = context;
  const { pathname } = url;
  const reqOrigin = context.request.headers.get("origin");

  // Handle CORS preflight for API requests
  if (context.request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return applySecurityHeaders(new Response(null, { status: 204 }), reqOrigin);
  }

  // Redirect www to non-www canonical domain (e.g. www.gamegata.xyz -> gamegata.xyz)
  if (url.hostname.startsWith("www.")) {
    const canonicalHost = url.hostname.replace(/^www\./, "");
    return applySecurityHeaders(redirect(`https://${canonicalHost}${pathname}${url.search}`, 301), reqOrigin);
  }

  // 1. Skip static assets
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|css|js|woff2|woff|ttf|ico)$/i)
  ) {
    return applySecurityHeaders(await next(), reqOrigin);
  }

  // 1.0. Global Security Check: Is Client IP Blocked or Lockout Cookie Active?
  const clientIp = getClientIp(context.request);
  const isBlocked = await isIpBlocked(clientIp);
  if (isBlocked) {
    return applySecurityHeaders(createRateLimitHtmlResponse(429, 86400));
  }

  const acceptHeader = context.request.headers.get("accept") || "";
  const secFetchDest = context.request.headers.get("sec-fetch-dest") || "";
  const isDocumentRequest = acceptHeader.includes("text/html") || secFetchDest === "document";

  // Check persistent lockout cookie for HTML page navigation
  if (isDocumentRequest && context.cookies.get("api_rate_limit_lockout")?.value === "1") {
    return applySecurityHeaders(createRateLimitHtmlResponse(429, 900));
  }

  // Enforce global document request rate limit (120 page views / min per IP)
  if (isDocumentRequest) {
    const docRl = await rateLimit(`doc_nav:${clientIp}`, 120, 60);
    if (!docRl.allowed) {
      return applySecurityHeaders(createRateLimitHtmlResponse(429, docRl.retryAfter));
    }
  }

  // 1.1. Instant 301 fast-redirect for /directory to GitHub Pages mirror
  if (pathname === "/directory" || pathname === "/directory/") {
    return applySecurityHeaders(redirect("https://project-hgg.github.io", 301));
  }

  // 1.5. Cloudflare Edge Cache MATCH check (0 DB reads for cached pages)
  const cache = !isDev && typeof caches !== "undefined" && (caches as any).default;
  const isCacheableGet = context.request.method === "GET" && (
    pathname === "/" ||
    pathname.startsWith("/game/") || 
    pathname.startsWith("/developer/") ||
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
        const hitRes = new Response(cachedResponse.body, cachedResponse);
        hitRes.headers.set("X-Gamegata-Cache", "HIT");
        return applySecurityHeaders(hitRes);
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
  // Skip if already on the maintenance page to prevent redirect loops
  const isMaintenancePage = pathname === "/maintenance" || pathname.startsWith("/maintenance/");
  if (!isMaintenancePage) {
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
    return applySecurityHeaders(await next(), reqOrigin);
  }

  // 5. Block /admin & /api/admin in open-core release
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return applySecurityHeaders(new Response("Not Found", { status: 404 }), reqOrigin);
  }

  const response = await next();

  // If an API route returns 429 (Rate Limit) or 500 (Internal Server Error)
  if (pathname.startsWith("/api/")) {
    if (response.status === 429 || response.status === 500) {
      const accept = context.request.headers.get("accept") || "";
      const secFetchDest = context.request.headers.get("sec-fetch-dest") || "";
      if (accept.includes("text/html") || secFetchDest === "document" || url.searchParams.has("html")) {
        return applySecurityHeaders(createRateLimitHtmlResponse(response.status), reqOrigin);
      }
    }
  }

  // Cloudflare Edge Cache PUT check
  if (cache && isCacheableGet && cacheKey && response.status === 200) {
    try {
      const cacheControl = response.headers.get("Cache-Control");
      if (cacheControl && cacheControl.includes("public")) {
        const responseToCache = response.clone();
        const cfCtx = (context.locals as any)?.runtime?.ctx || (context.locals as any)?.cfContext;
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

  return applySecurityHeaders(response, reqOrigin);
});
