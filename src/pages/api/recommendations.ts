import type { APIRoute } from 'astro';
import { getServerUser } from '../../lib/serverAuth';
import { turso } from '../../lib/turso';
import { tursoAuth } from '../../lib/tursoAuth';
import { wishlist as wishlistTable, collection as collectionTable } from '../../db/auth-schema';
import {
  games as gamesTable,
  gameRecommendations as gameRecommendationsTable,
  tags as tagsTable,
  gamesToTags
} from '../../db/schema';
import { enrichGamesWithRelations } from '../../lib/gameQueries';
import { eq, inArray, and, notInArray, desc } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "4", 10);
    
    let excludeGameIds: string[] = [];
    let reasonString = "Personalized for you";
    let seedGameId: string | null = null;

    const user = await getServerUser(request, cookies);
    
    if (user) {
      // Get most recent wishlist item as seed from separate Auth Database
      const latestWishlist = await tursoAuth
        .select({ gameId: wishlistTable.gameId })
        .from(wishlistTable)
        .where(eq(wishlistTable.userId, user.id))
        .orderBy(desc(wishlistTable.createdAt))
        .limit(1);
      
      if (latestWishlist[0]) {
        // Query the seed game title from Catalog Database
        const [gameRow] = await turso
          .select({ title: gamesTable.title })
          .from(gamesTable)
          .where(eq(gamesTable.id, latestWishlist[0].gameId))
          .limit(1);

        if (gameRow) {
          seedGameId = latestWishlist[0].gameId;
          reasonString = `Because you wishlisted ${gameRow.title}`;
          
          // Exclude all wishlisted and collected games
          const [wishlistItems, collectionItems] = await Promise.all([
            tursoAuth.select({ gameId: wishlistTable.gameId }).from(wishlistTable).where(eq(wishlistTable.userId, user.id)),
            tursoAuth.select({ gameId: collectionTable.gameId }).from(collectionTable).where(eq(collectionTable.userId, user.id)),
          ]);
          
          excludeGameIds = [
            ...wishlistItems.map((w) => w.gameId),
            ...collectionItems.map((c) => c.gameId),
          ];
        }
      }
    }

    // Fallback to client-side affinities (tags favorite vibe)
    if (!seedGameId) {
      const clientTagsParam = searchParams.get("tags");
      if (clientTagsParam) {
        const topTags = clientTagsParam.split(",").filter(t => t.trim() !== "");
        if (topTags.length > 0) {
          // Find tagId corresponding to topTags[0]
          const matchedTag = await turso
            .select({ id: tagsTable.id })
            .from(tagsTable)
            .where(eq(tagsTable.slug, topTags[0]))
            .limit(1);

          if (matchedTag[0]) {
            // Find a highly rated game matching their vibe from Turso
            const candidate = await turso
              .select({ id: gamesTable.id })
              .from(gamesTable)
              .innerJoin(gamesToTags, eq(gamesTable.id, gamesToTags.gameId))
              .where(eq(gamesToTags.tagId, matchedTag[0].id))
              .orderBy(desc(gamesTable.rating))
              .limit(1);
            
            if (candidate[0]) {
              seedGameId = candidate[0].id;
              reasonString = `Because you like ${topTags[0].replace(/-/g, " ")} vibes`;
              excludeGameIds.push(seedGameId);
            }
          }
        }
      }
    }

    if (!seedGameId) {
      return new Response(JSON.stringify({ games: [], reason: null }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Query precomputed recommendations from Turso (Catalog DB)
    const queryConditions = [eq(gameRecommendationsTable.gameId, seedGameId)];
    if (excludeGameIds.length > 0) {
      queryConditions.push(notInArray(gameRecommendationsTable.recommendedGameId, excludeGameIds));
    }

    const recsData = await turso
      .select()
      .from(gameRecommendationsTable)
      .where(and(...queryConditions))
      .orderBy(gameRecommendationsTable.distance)
      .limit(limit);

    const recGameIds = recsData.map(r => r.recommendedGameId);
    let recommendedGames: any[] = [];

    if (recGameIds.length > 0) {
      const rawGames = await turso
        .select()
        .from(gamesTable)
        .where(inArray(gamesTable.id, recGameIds));
      
      const enriched = await enrichGamesWithRelations(rawGames);
      const gameMap = new Map(enriched.map(g => [g.id, g]));

      recommendedGames = recsData
        .map(r => gameMap.get(r.recommendedGameId))
        .filter(Boolean);
    }

    if (recommendedGames.length === 0) {
      return new Response(JSON.stringify({ games: [], reason: null }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({
        games: recommendedGames,
        reason: reasonString,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Recommendations error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch recommendations" }), { status: 500 });
  }
};
