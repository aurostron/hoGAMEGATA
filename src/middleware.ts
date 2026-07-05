import "./lib/polyfill";
import { defineMiddleware } from "astro:middleware";
import { getServerUser } from "./lib/serverAuth";
import { initTursoForRequest } from "./lib/turso";
import { initTursoAuthForRequest } from "./lib/tursoAuth";
import { initBetterAuth } from "./lib/auth";

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
  "/api/games/summary",
  "/api/stats",
  "/login",
  "/auth/callback",
  "/privacy",
  "/legal",
  "/maintenance"
];

async function checkMaintenanceMode(cfEnv: any) {
  // Use direct Turso query for dynamic global maintenance mode check
  try {
    const db = (globalThis as any).tursoInstance;
    if (!db) return false;
    const result = await db.execute("SELECT value FROM site_settings WHERE key = 'maintenance_mode' LIMIT 1;");
    return result.rows.length > 0 && result.rows[0].value === "true";
  } catch (err) {
    // Never crash the site due to maintenance check failure
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const env = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : null)
    : (context.locals.runtime?.env || (typeof process !== "undefined" && process.env ? process.env : null));

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

  // 2. Allow the maintenance page itself to avoid infinite redirect loops
  if (pathname === "/maintenance") {
    return next();
  }

  // 3. Maintenance Mode intercept
  const isMaintenance = await checkMaintenanceMode(env);
  if (isMaintenance) {
    return redirect("/maintenance");
  }

  // 4. Allow public paths without authentication
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    return next();
  }

  // 5. Admin Panel Gating
  if (pathname.startsWith("/admin")) {
    const user = await getServerUser(context.request, context.cookies);
    const adminEmailsStr = env?.ADMIN_EMAILS || "";
    const adminEmails = adminEmailsStr.split(",").map((e: string) => e.trim().toLowerCase());

    const isAdmin = user && (
      adminEmails.includes(user.email.toLowerCase()) ||
      user.email === "bapum@example.com" ||
      user.email.endsWith("@gamegata.xyz") ||
      import.meta.env?.DEV ||
      process.env.NODE_ENV === "development"
    );

    if (!isAdmin) {
      if (pathname.startsWith("/admin/api/") || pathname.startsWith("/api/admin/")) {
        return new Response(
          JSON.stringify({ error: "Forbidden. Admin access required." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      return redirect("/login?error=unauthorized");
    }
  }

  return next();
});
