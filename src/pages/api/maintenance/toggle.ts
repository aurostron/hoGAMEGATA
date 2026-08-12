import type { APIRoute } from "astro";
import { env as cfEnv } from "cloudflare:workers";
import { getServerUser, isAdminUser } from "../../../lib/serverAuth";
import { initTursoForRequest } from "../../../lib/turso";
import { initTursoAuthForRequest } from "../../../lib/tursoAuth";
import { initBetterAuth } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ url, cookies, redirect, request }) => {
  const key = url.searchParams.get("key");
  const state = url.searchParams.get("state"); // "on" | "off"
  const clearCookie = url.searchParams.get("clear_cookie") === "true";

  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const envToUse = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  // Ensure DB & Auth clients are initialized for this request
  initTursoForRequest(envToUse);
  initTursoAuthForRequest(envToUse);
  initBetterAuth(envToUse);

  const secret = (envToUse as any).MAINTENANCE_SECRET;
  const kv = (envToUse as any).MAINTENANCE as KVNamespace | undefined;

  // Check 1: Valid secret key
  const hasValidSecret = secret && key === secret;

  // Check 3: Authenticated Admin Session (Logged-in Admin user)
  const user = await getServerUser(request, cookies);
  const isAdmin = user && isAdminUser(user.email, envToUse);

  // Allow if secret is valid, from admin panel, logged-in admin, OR running in development mode (localhost)
  if (!hasValidSecret && !isAdmin && !isDev) {
    return new Response("Forbidden: Admin session or valid secret key required.", { status: 403 });
  }

  // Handle clear_cookie request (let developer see the maintenance page)
  if (clearCookie) {
    cookies.delete("maintenance_bypass", { path: "/" });
    return redirect("/admin");
  }

  if (!state || (state !== "on" && state !== "off")) {
    return new Response(
      "Invalid request. Use ?state=on or ?state=off (or ?key=SECRET&state=on)",
      { status: 400 }
    );
  }

  // Write maintenance state to KV if available
  if (kv) {
    try {
      await kv.put("status", state);
      await kv.put("source", state === "on" ? "manual" : "");
    } catch (e) {
      console.error("[Maintenance Toggle] Failed to update KV:", e);
    }
  }

  if (state === "on") {
    // Set bypass cookie so developer/admin can still access the live site
    cookies.set("maintenance_bypass", secret || "dev_bypass_secret", {
      path: "/",
      httpOnly: true,
      secure: !isDev,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return redirect("/admin");
  } else {
    // Maintenance is off — clear the cookie
    cookies.delete("maintenance_bypass", { path: "/" });
    return redirect("/admin");
  }
};
