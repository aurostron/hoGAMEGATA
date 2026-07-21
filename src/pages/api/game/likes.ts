import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import { games } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';

export const prerender = false;

// GET: Fetch current likes count for a game
export const GET: APIRoute = async ({ url }) => {
  const gameId = url.searchParams.get("gameId");
  if (!gameId) {
    return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
  }

  try {
    const [row] = await turso
      .select({ likesCount: games.likesCount })
      .from(games)
      .where(eq(games.id, gameId));

    const likesCount = row?.likesCount ?? 0;
    return new Response(JSON.stringify({ likesCount }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, s-maxage=120",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch likes" }), { status: 500 });
  }
};

// POST: Guest toggle (increment or decrement likes count directly)
export const POST: APIRoute = async ({ request }) => {
  try {
    const { gameId, action } = await request.json();
    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    const delta = action === "decrement" ? -1 : 1;
    await turso
      .update(games)
      .set({
        likesCount: sql`MAX(0, COALESCE(${games.likesCount}, 0) + ${delta})`,
      })
      .where(eq(games.id, gameId));

    const [row] = await turso
      .select({ likesCount: games.likesCount })
      .from(games)
      .where(eq(games.id, gameId));

    return new Response(JSON.stringify({ success: true, likesCount: row?.likesCount ?? 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to update likes" }), { status: 500 });
  }
};
