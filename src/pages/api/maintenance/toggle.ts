import type { APIRoute } from "astro";
import { env as cfEnv } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect, request }) => {
  const key = url.searchParams.get("key");
  const state = url.searchParams.get("state"); // "on" | "off"
  const clearCookie = url.searchParams.get("clear_cookie") === "true";

  const secret = (cfEnv as any).MAINTENANCE_SECRET;
  const kv = (cfEnv as any).MAINTENANCE as KVNamespace;

  // Verify secret key OR request came from the admin panel (already auth-gated)
  const referer = request.headers.get("Referer") ?? "";
  const isFromAdmin = referer.includes("/admin");
  if (!secret || (key !== secret && !isFromAdmin)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Handle clear_cookie request (let developer see the maintenance page)
  if (clearCookie) {
    cookies.delete("maintenance_bypass", { path: "/" });
    return redirect("/admin");
  }

  if (!state || (state !== "on" && state !== "off")) {
    return new Response(
      "Invalid request. Use ?key=SECRET&state=on or ?key=SECRET&state=off",
      { status: 400 }
    );
  }

  // Write maintenance state to KV
  await kv.put("status", state);
  // Track source so BetterStack webhooks cannot override manual maintenance
  await kv.put("source", state === "on" ? "manual" : "");

  if (state === "on") {
    // Set bypass cookie so developer can still access the live site
    cookies.set("maintenance_bypass", secret, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return redirect("/admin");
  } else {
    // Maintenance is off — clear the cookie (optional, it won't be checked anyway)
    cookies.delete("maintenance_bypass", { path: "/" });
    return redirect("/admin");
  }
};
