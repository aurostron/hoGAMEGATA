import type { APIRoute } from 'astro';
import { getServerUser } from '../../../lib/serverAuth';
import { tursoAuth, initTursoAuthForRequest } from '../../../lib/tursoAuth';
import { initTursoForRequest } from '../../../lib/turso';
import { wishlist as wishlistTable } from '../../../db/auth-schema';
import { eq, desc, and } from 'drizzle-orm';
import { env as cfEnv } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { request, cookies } = context;
  try {
    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
    const env = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : (cfEnv || (context.locals as any)?.runtime?.env || (typeof process !== "undefined" ? process.env : {}));
    
    if (env) {
      initTursoForRequest(env);
      initTursoAuthForRequest(env);
    }

    const user = await getServerUser(request, cookies, env);
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

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;
  try {
    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
    const env = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : (cfEnv || (context.locals as any)?.runtime?.env || (typeof process !== "undefined" ? process.env : {}));
    
    if (env) {
      initTursoForRequest(env);
      initTursoAuthForRequest(env);
    }

    const user = await getServerUser(request, cookies, env);
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

    // Increment likesCount on games table in main DB
    try {
      const { turso } = await import('../../../lib/turso');
      const { games } = await import('../../../db/schema');
      const { sql } = await import('drizzle-orm');
      await turso
        .update(games)
        .set({ likesCount: sql`MAX(0, COALESCE(${games.likesCount}, 0) + 1)` })
        .where(eq(games.id, gameId));
    } catch (e) {
      console.warn("Failed to increment likesCount:", e);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist add failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const { request, cookies } = context;
  try {
    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
    const env = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : (cfEnv || (context.locals as any)?.runtime?.env || (typeof process !== "undefined" ? process.env : {}));
    
    if (env) {
      initTursoForRequest(env);
      initTursoAuthForRequest(env);
    }

    const user = await getServerUser(request, cookies, env);
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

    // Decrement likesCount on games table in main DB
    try {
      const { turso } = await import('../../../lib/turso');
      const { games } = await import('../../../db/schema');
      const { sql } = await import('drizzle-orm');
      await turso
        .update(games)
        .set({ likesCount: sql`MAX(0, COALESCE(${games.likesCount}, 0) - 1)` })
        .where(eq(games.id, gameId));
    } catch (e) {
      console.warn("Failed to decrement likesCount:", e);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist delete failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
