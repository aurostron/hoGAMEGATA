import type { APIRoute } from "astro";
import { trackLinkClick } from "../../../lib/analytics";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { gameId, storeName, refTitle } = await request.json();

    if (!gameId || !storeName) {
      return new Response(
        JSON.stringify({ error: "Missing gameId or storeName" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call tracking (using waitUntil if available, otherwise fallback await)
    const trackPromise = trackLinkClick(gameId, storeName, refTitle || `${gameId} link`);
    const cf = locals.cloudflare || (locals as any).runtime;
    if (cf?.ctx?.waitUntil) {
      cf.ctx.waitUntil(trackPromise);
    } else {
      await trackPromise;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Track Click API] Error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to track click" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
