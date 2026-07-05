import type { APIRoute } from 'astro';
import { getServerUser } from '../../../lib/serverAuth';
import { tursoAuth } from '../../../lib/tursoAuth';
import { wishlist as wishlistTable } from '../../../db/auth-schema';
import { eq, desc, and } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Query separate Auth Database for wishlist items
    const wishlistItems = await tursoAuth
      .select({ gameId: wishlistTable.gameId, createdAt: wishlistTable.createdAt })
      .from(wishlistTable)
      .where(eq(wishlistTable.userId, user.id))
      .orderBy(desc(wishlistTable.createdAt));

    const gameIds = wishlistItems.map((item) => item.gameId);
    let wishlistGames: any[] = [];

    if (gameIds.length > 0) {
      const { turso } = await import('../../../lib/turso');
      const { games } = await import('../../../db/schema');
      const { inArray } = await import('drizzle-orm');
      const { enrichGamesWithRelations } = await import('../../../lib/gameQueries');

      // Query Catalog Database for metadata details
      const rawGames = await turso
        .select()
        .from(games)
        .where(inArray(games.id, gameIds));
      
      const enrichedGames = await enrichGamesWithRelations(rawGames);
      const gameMap = new Map(enrichedGames.map(g => [g.id, g]));
      wishlistGames = gameIds.map(id => gameMap.get(id)).filter(Boolean);
    }

    return new Response(JSON.stringify({ wishlist: wishlistGames }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist fetch failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await request.json();

    // Check if bulk sync request
    if (body.items && Array.isArray(body.items)) {
      const syncItems = body.items.map((gameId: string) => ({
        id: crypto.randomUUID(),
        userId: user.id,
        gameId,
      }));

      if (syncItems.length > 0) {
        await Promise.all(
          syncItems.map(item =>
            tursoAuth
              .insert(wishlistTable)
              .values(item)
              .onConflictDoNothing()
          )
        );
      }

      return new Response(JSON.stringify({ success: true, count: syncItems.length }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { gameId } = body;
    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    // Insert into separate Auth Database
    await tursoAuth
      .insert(wishlistTable)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        gameId,
      })
      .onConflictDoNothing();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist add failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { gameId } = await request.json();
    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    // Delete from separate Auth Database
    await tursoAuth
      .delete(wishlistTable)
      .where(
        and(
          eq(wishlistTable.userId, user.id),
          eq(wishlistTable.gameId, gameId)
        )
      );

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist delete failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
