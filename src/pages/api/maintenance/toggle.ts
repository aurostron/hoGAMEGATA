import type { APIRoute } from "astro";
import { env as cfEnv } from "cloudflare:workers";
import { getServerUser, isAdminUser } from "../../../lib/serverAuth";

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect, request }) => {
  const key = url.searchParams.get("key");
  const state = url.searchParams.get("state"); // "on" | "off"
  const clearCookie = url.searchParams.get("clear_cookie") === "true";

  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const envToUse = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  const secret = (envToUse as any).MAINTENANCE_SECRET;
  const kv = (envToUse as any).MAINTENANCE as KVNamespace | undefined;

  // Check 1: Valid secret key
  const hasValidSecret = secret && key === secret;

  // Check 2: Came from Admin Panel referer
  const referer = request.headers.get("Referer") ?? "";
  const isFromAdmin = referer.includes("/admin");

  // Check 3: Authenticated Admin Session (Logged-in Admin user)
  const user = await getServerUser(request, cookies);
  const isAdmin = user && isAdminUser(user.email, envToUse);

  if (!hasValidSecret && !isFromAdmin && !isAdmin) {
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
    await kv.put("status", state);
    await kv.put("source", state === "on" ? "manual" : "");
  }

  if (state === "on") {
    // Set bypass cookie so developer can still access the live site
    if (secret) {
      cookies.set("maintenance_bypass", secret, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return redirect("/admin");
  } else {
    // Maintenance is off — clear the cookie
    cookies.delete("maintenance_bypass", { path: "/" });
    return redirect("/admin");
  }
};
