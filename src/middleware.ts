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
];


export const onRequest = defineMiddleware(async (context, next) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const env = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : cfEnv;

  if (env) {
    initTursoForRequest(env);
    initTursoAuthForRequest(env);
    initBetterAuth(env);
  }

  const { url, redirect } = context;
  const { pathname } = url;

  // 1. Skip static assets
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|css|js|woff2|woff|ttf|ico)$/i)
  ) {
    return next();
  }

  // 1.5. Cloudflare Edge Cache MATCH check (0 DB reads for cached pages)
  const cache = typeof caches !== "undefined" && (caches as any).default;
  const isCacheableGet = context.request.method === "GET" && (
    pathname.startsWith("/game/") || 
    pathname.startsWith("/api/games") || 
    pathname === "/sitemap.xml" ||
    pathname === "/api/stats"
  );

  const cacheKey = isCacheableGet && new Request(context.request.url, context.request);
  if (cache && isCacheableGet && cacheKey) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (e) {
      console.error("[Edge Cache Match Error]", e);
    }
  }

  // 2. Maintenance mode check via Cloudflare KV (0 DB reads)
  // Skip if already on the maintenance page or maintenance API to prevent redirect loops
  const isMaintenancePage = pathname === "/maintenance" || pathname.startsWith("/maintenance/");
  const isMaintenanceApi = pathname.startsWith("/api/maintenance");
  if (!isMaintenancePage && !isMaintenanceApi) {
    try {
      const kv = (cfEnv as any).MAINTENANCE as KVNamespace | undefined;
      if (kv) {
        const maintenanceStatus = await kv.get("status");
        if (maintenanceStatus === "on") {
          // Check for developer bypass cookie
          const bypassCookie = context.cookies.get("maintenance_bypass")?.value;
          const secret = (cfEnv as any).MAINTENANCE_SECRET;
          const hasBypass = bypassCookie && secret && bypassCookie === secret;
          if (!hasBypass) {
            // Use absolute URL redirect to avoid any relative-path confusion
            return redirect("https://gamegata.xyz/maintenance", 307);
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
    return next();
  }

  // 5. Admin Panel Gating
  if (pathname.startsWith("/admin")) {
    const user = await getServerUser(context.request, context.cookies);
    const isAdmin = user && isAdminUser(user.email, env);

    if (!isAdmin) {
      if (context.cookies.has("admin_2fa_session")) {
        context.cookies.delete("admin_2fa_session", { path: "/" });
      }
      if (pathname.startsWith("/admin/api/") || pathname.startsWith("/api/admin/")) {
        return new Response(
          JSON.stringify({ error: "Forbidden. Admin access required." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      return redirect("/login?error=unauthorized");
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
          return new Response(
            JSON.stringify({ error: "Forbidden. 2FA verification required." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        return redirect("/admin/verify-2fa");
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
        const cfCtx = (context.locals as any).runtime?.ctx;
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

  return response;
});
