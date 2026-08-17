import type { APIRoute } from 'astro';
import { turso } from '../../lib/turso';
import { games as gamesTable } from '../../db/schema';
import { count, or, isNull, ne } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [countRow] = await turso
      .select({ total: count() })
      .from(gamesTable)
      .where(or(isNull(gamesTable.status), ne(gamesTable.status, "hidden")));

    const totalGames = countRow?.total || 0;
    if (totalGames === 0) {
      return new Response(JSON.stringify({ error: "No games found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const randomIndex = Math.floor(Math.random() * totalGames);
    const [randomGame] = await turso
      .select({ slug: gamesTable.slug, title: gamesTable.title })
      .from(gamesTable)
      .where(or(isNull(gamesTable.status), ne(gamesTable.status, "hidden")))
      .limit(1)
      .offset(randomIndex);

    if (!randomGame?.slug) {
      return new Response(JSON.stringify({ error: "Game not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(
      JSON.stringify({
        slug: randomGame.slug,
        title: randomGame.title || "Unknown Nightmare"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      }
    );
  } catch (error) {
    console.error("❌ Random API fetch failed:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
