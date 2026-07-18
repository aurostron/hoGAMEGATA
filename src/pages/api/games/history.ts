import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import { gameRevisions } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const gameId = url.searchParams.get("gameId");

    if (!gameId || typeof gameId !== "string" || !gameId.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid gameId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const rows = await turso
      .select()
      .from(gameRevisions)
      .where(eq(gameRevisions.gameId, gameId.trim()))
      .orderBy(desc(gameRevisions.createdAt))
      .limit(50);

    const formattedHistory = rows.map((r) => {
      let changes = {};
      try {
        changes = JSON.parse(r.changesJson);
      } catch (e) {
        changes = {};
      }
      return {
        id: r.id,
        gameId: r.gameId,
        suggestionId: r.suggestionId,
        editedBy: r.editedBy || "community",
        changes,
        createdAt: r.createdAt,
      };
    });

    return new Response(
      JSON.stringify({ history: formattedHistory }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("❌ Error fetching revision history:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch revision history" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
