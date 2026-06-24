import type { APIRoute } from 'astro';
import { getDbStats } from '../../lib/dbRpc';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const stats = await getDbStats();

    if (!stats) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch database stats" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(stats),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("❌ Failed to fetch database stats:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch database stats" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
