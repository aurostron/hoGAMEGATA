import type { APIRoute } from "astro";
import { env as cfEnv } from "cloudflare:workers";

export const prerender = false;

// HetrixTools sends a POST with a JSON body when monitor status changes.
// Authorization is via Bearer token in the Authorization header.
// Payload key field: monitor_status = "online" | "offline"
export const POST: APIRoute = async ({ request }) => {
  const kv = (cfEnv as any).MAINTENANCE as KVNamespace;
  const webhookSecret = (cfEnv as any).BETTERSTACK_WEBHOOK_SECRET;

  // Verify Authorization header (same secret, reusing the env var)
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!webhookSecret || token !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // HetrixTools payload: { monitor_status: "offline" | "online", ... }
  const monitorStatus: string = body?.monitor_status ?? "";

  // "offline" means site is DOWN → enable maintenance (automatic source)
  if (monitorStatus === "offline") {
    await kv.put("status", "on");
    await kv.put("source", "automatic");
    console.log("[Maintenance] HetrixTools triggered maintenance ON (automatic)");
    return new Response(JSON.stringify({ ok: true, maintenance: "on", source: "automatic" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // "online" means site is back UP → but ONLY turn off if WE turned it on automatically.
  // If the admin manually enabled maintenance, HetrixTools must NOT override that.
  if (monitorStatus === "online") {
    const source = await kv.get("source");

    if (source === "manual") {
      // Admin manually enabled maintenance — ignore the recovery signal
      console.log("[Maintenance] HetrixTools recovery ignored — maintenance was set manually by admin.");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "manual maintenance active" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Automatic maintenance — safe to turn off on recovery
    await kv.put("status", "off");
    await kv.put("source", "");
    console.log("[Maintenance] HetrixTools triggered maintenance OFF (automatic recovery)");
    return new Response(JSON.stringify({ ok: true, maintenance: "off" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Unknown status — acknowledge but do nothing
  return new Response(JSON.stringify({ ok: true, skipped: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
