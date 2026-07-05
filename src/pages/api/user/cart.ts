import type { APIRoute } from 'astro';
import { getServerUser } from '../../../lib/serverAuth';
import { tursoAuth } from '../../../lib/tursoAuth';
import { cartItem as cartItemTable } from '../../../db/auth-schema';
import { eq, desc, and } from 'drizzle-orm';

export const prerender = false;

// GET /api/user/cart - Retrieve user's synced cart items
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { searchParams } = new URL(request.url);
    const gameIdsParam = searchParams.get("gameIds");

    let user = null;
    try {
      user = await getServerUser(request, cookies);
    } catch { /* ignore */ }

    let gameIds: string[] = [];
    let cartItems: any[] = [];

    if (gameIdsParam) {
      gameIds = gameIdsParam.split(",").filter(Boolean);
      cartItems = gameIds.map(id => ({ gameId: id, storeName: null, createdAt: new Date().toISOString() }));
    } else {
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      // Query separate Auth Database for cart items
      const dbCartItems = await tursoAuth
        .select({ gameId: cartItemTable.gameId, storeName: cartItemTable.storeName, createdAt: cartItemTable.createdAt })
        .from(cartItemTable)
        .where(eq(cartItemTable.userId, user.id))
        .orderBy(desc(cartItemTable.createdAt));

      cartItems = dbCartItems || [];
      gameIds = cartItems.map((item: any) => item.gameId);
    }

    let cartGames: any[] = [];

    if (gameIds.length > 0) {
      const { turso } = await import('../../../lib/turso');
      const { games, priceSnapshots } = await import('../../../db/schema');
      const { inArray } = await import('drizzle-orm');
      const { enrichGamesWithRelations } = await import('../../../lib/gameQueries');

      // Query Catalog Database for metadata
      const rawGames = await turso
        .select()
        .from(games)
        .where(inArray(games.id, gameIds));
      
      const rawPriceSnapshots = await turso
        .select()
        .from(priceSnapshots)
        .where(inArray(priceSnapshots.gameId, gameIds));
      
      const enrichedGames = await enrichGamesWithRelations(rawGames);
      const gameMap = new Map(enrichedGames.map(g => [g.id, g]));

      // Group price snapshots by gameId
      const priceSnapshotsMap = new Map<string, any[]>();
      for (const snap of rawPriceSnapshots) {
        if (!priceSnapshotsMap.has(snap.gameId)) {
          priceSnapshotsMap.set(snap.gameId, []);
        }
        priceSnapshotsMap.get(snap.gameId)!.push(snap);
      }

      // Merge the store selection
      cartGames = cartItems.map((item: any) => {
        const game = gameMap.get(item.gameId);
        if (!game) return null;
        return {
          ...game,
          priceSnapshots: priceSnapshotsMap.get(item.gameId) || [],
          selectedStore: item.storeName,
          cartCreatedAt: item.createdAt
        };
      }).filter(Boolean);
    }

    return new Response(JSON.stringify({ cart: cartGames }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Cart fetch failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

// POST /api/user/cart - Add, update store choice, or bulk sync items
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await request.json();

    // Check if bulk sync
    if (body.items && Array.isArray(body.items)) {
      const syncItems = body.items.map((item: any) => ({
        gameId: item.gameId,
        storeName: item.storeName || null,
      }));

      if (syncItems.length > 0) {
        // Upsert all items in separate Auth Database
        await Promise.all(
          syncItems.map(item =>
            tursoAuth
              .insert(cartItemTable)
              .values({
                id: crypto.randomUUID(),
                userId: user.id,
                gameId: item.gameId,
                storeName: item.storeName,
              })
              .onConflictDoUpdate({
                target: [cartItemTable.userId, cartItemTable.gameId],
                set: { storeName: item.storeName }
              })
          )
        );
      }

      return new Response(JSON.stringify({ success: true, count: syncItems.length }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Otherwise, single item add/update
    const { gameId, storeName } = body;
    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    await tursoAuth
      .insert(cartItemTable)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        gameId,
        storeName: storeName || null,
      })
      .onConflictDoUpdate({
        target: [cartItemTable.userId, cartItemTable.gameId],
        set: { storeName: storeName || null },
      });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Cart update failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

// DELETE /api/user/cart - Remove item or clear cart
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { gameId, clearAll } = body;

    if (clearAll) {
      await tursoAuth
        .delete(cartItemTable)
        .where(eq(cartItemTable.userId, user.id));

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    await tursoAuth
      .delete(cartItemTable)
      .where(
        and(
          eq(cartItemTable.userId, user.id),
          eq(cartItemTable.gameId, gameId)
        )
      );

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Cart delete failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
