import type { APIRoute } from 'astro';
import { getUserReputation } from '../../../lib/userReputation';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const userId = url.searchParams.get("userId");

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid userId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const reputation = await getUserReputation(userId.trim());

    return new Response(
      JSON.stringify({ reputation }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("❌ Error fetching user reputation:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch user reputation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
