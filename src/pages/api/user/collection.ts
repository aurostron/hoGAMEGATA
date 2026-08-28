import type { APIRoute } from 'astro';
import { getServerUser } from '../../../lib/serverAuth';
import { tursoAuth, initTursoAuthForRequest } from '../../../lib/tursoAuth';
import { initTursoForRequest } from '../../../lib/turso';
import { collection as collectionTable } from '../../../db/auth-schema';
import { eq, desc, and } from 'drizzle-orm';
import { env as cfEnv } from "cloudflare:workers";

export const prerender = false;

const VALID_STATUSES = ["OWNED", "PLAYING", "COMPLETED", "WANT_TO_PLAY"] as const;

export const GET: APIRoute = async (context) => {
  const { request, cookies } = context;
  try {
    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
    const env = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : (cfEnv || (typeof process !== "undefined" ? process.env : {}));
    
    if (env) {
      initTursoForRequest(env);
      initTursoAuthForRequest(env);
    }

    const user = await getServerUser(request, cookies, env);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Query separate Auth Database for collection items
    const collectionItems = await tursoAuth
      .select({ gameId: collectionTable.gameId, status: collectionTable.status, createdAt: collectionTable.createdAt })
      .from(collectionTable)
      .where(eq(collectionTable.userId, user.id))
      .orderBy(desc(collectionTable.createdAt));

    const gameIds = collectionItems.map((item) => item.gameId);
    let collectionGames: any[] = [];

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

      collectionGames = collectionItems
        .map((item) => ({
          status: item.status,
          game: gameMap.get(item.gameId),
        }))
        .filter((item) => !!item.game);
    }

    return new Response(JSON.stringify({ collection: collectionGames }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Collection fetch failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;
  try {
    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
    const env = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : (cfEnv || (typeof process !== "undefined" ? process.env : {}));
    
    if (env) {
      initTursoForRequest(env);
      initTursoAuthForRequest(env);
    }

    const user = await getServerUser(request, cookies, env);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { gameId, status } = await request.json();
    if (!gameId || !status) {
      return new Response(JSON.stringify({ error: "Missing gameId or status" }), { status: 400 });
    }

    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return new Response(JSON.stringify({ error: "Invalid status value" }), { status: 400 });
    }

    // Upsert into separate Auth Database
    await tursoAuth
      .insert(collectionTable)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        gameId,
        status,
      })
      .onConflictDoUpdate({
        target: [collectionTable.userId, collectionTable.gameId],
        set: { status, updatedAt: new Date() },
      });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Collection update failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const { request, cookies } = context;
  try {
    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env?.NODE_ENV === "development");
    const env = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : (cfEnv || (typeof process !== "undefined" ? process.env : {}));
    
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
      .delete(collectionTable)
      .where(
        and(
          eq(collectionTable.userId, user.id),
          eq(collectionTable.gameId, gameId)
        )
      );

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Collection delete failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
