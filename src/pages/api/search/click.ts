import { rateLimit, getClientIp, tooManyRequests } from '../../../lib/rateLimit';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`search_click:${clientIp}`, 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  try {
    const { query, gameId, position } = await request.json();

    if (!query || !gameId || typeof position !== "number") {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // Search-click logging deleted (2026-09-09): acknowledge without any DB write.
    const clickId = crypto.randomUUID();
    void query;
    void gameId;
    void position;

    return new Response(JSON.stringify({ success: true, id: clickId }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Search click logging failed:", error);
    return new Response(JSON.stringify({ error: "Failed to log search click" }), { status: 500 });
  }
};
