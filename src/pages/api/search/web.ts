import type { APIRoute } from 'astro';
import { performWebSearch } from '../../../lib/webSearch';
import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");

export const GET: APIRoute = async ({ request }) => {
  if (!isDev) {
    return new Response(JSON.stringify({ error: 'Not available' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query || typeof query !== "string" || !query.trim()) {
      return new Response(JSON.stringify({ error: "Missing or invalid query parameter" }), { status: 400 });
    }

    const env = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : cfEnv;

    console.log(`📡 [Web Search Route] Searching for: "${query}"`);
    const results = await performWebSearch(query.trim(), env);

    return new Response(
      JSON.stringify({ results }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" // Cache web queries for 1 hour at edge
        }
      }
    );
  } catch (error) {
    console.error("❌ Web Search API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to perform web search discovery" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
