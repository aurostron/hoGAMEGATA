import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getServerUser } from "@/lib/serverAuth";
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "4");
    
    let excludeGameIds: string[] = [];
    let reasonString = "Personalized for you";
    let seedGameId: string | null = null;

    // 1. Try to get logged-in user signals first (most recent wishlist item)
    const user = await getServerUser();
    
    if (user) {
      const latestWishlist = await db.wishlist.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { game: true }
      });
      
      if (latestWishlist) {
        seedGameId = latestWishlist.gameId;
        reasonString = `Because you wishlisted ${latestWishlist.game.title}`;
        
        // Exclude all their wishlisted and collected games from recommendations
        const allLists = await db.wishlist.findMany({ where: { userId: user.id }, select: { gameId: true } });
        const allCollections = await db.collection.findMany({ where: { userId: user.id }, select: { gameId: true } });
        excludeGameIds = [...allLists.map(w => w.gameId), ...allCollections.map(c => c.gameId)];
      }
    }

    // 2. Fallback to client-side affinities if no user or no items in lists
    if (!seedGameId) {
      const clientTagsParam = searchParams.get("tags");
      if (clientTagsParam) {
        const topTags = clientTagsParam.split(",").filter(t => t.trim() !== "");
        if (topTags.length > 0) {
          // Find a highly rated game matching their favorite vibe to use as the semantic seed
          const seedCandidate = await db.game.findFirst({
            where: {
              OR: [
                { tags: { some: { slug: topTags[0] } } },
                { genres: { some: { slug: topTags[0] } } }
              ]
            },
            orderBy: { rating: 'desc' },
          });
          
          if (seedCandidate) {
            seedGameId = seedCandidate.id;
            reasonString = `Because you like ${topTags[0].replace(/-/g, ' ')} vibes`;
            excludeGameIds.push(seedGameId);
          }
        }
      }
    }

    // 3. If still no seed, we can't provide dynamic recommendations, return empty
    if (!seedGameId) {
      return NextResponse.json({ games: [], reason: null });
    }

    // 4. Perform AI Vector Search using pgvector
    // We find games whose embeddings are geometrically closest to our seed game's embedding.
    // Ensure we only recommend games that actually belong to the targeted genre/vibe.
    let vectorResults;
    
    if (searchParams.get("tags") && !user) {
      // If filtering by specific vibes, explicitly join and enforce the tag/genre
      const topTag = searchParams.get("tags")!.split(",")[0].trim();
      vectorResults = await db.$queryRaw<{ id: string }[]>`
        SELECT g.id
        FROM "Game" g
        LEFT JOIN "_GameToTag" gtt ON g.id = gtt."A"
        LEFT JOIN "Tag" t ON gtt."B" = t.id
        LEFT JOIN "_GameToGenre" gtg ON g.id = gtg."A"
        LEFT JOIN "Genre" gen ON gtg."B" = gen.id
        WHERE g.id != ${seedGameId}
          AND (t.slug = ${topTag} OR gen.slug = ${topTag})
          AND g.embedding IS NOT NULL
          ${excludeGameIds.length > 0 ? Prisma.sql`AND g.id NOT IN (${Prisma.join(excludeGameIds)})` : Prisma.empty}
        GROUP BY g.id, g.embedding
        ORDER BY g.embedding <-> (SELECT embedding FROM "Game" WHERE id = ${seedGameId})
        LIMIT ${limit}
      `;
    } else {
      // If personalized for the user generally, no strict tag constraint
      vectorResults = await db.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Game"
        WHERE id != ${seedGameId}
          AND embedding IS NOT NULL
          ${excludeGameIds.length > 0 ? Prisma.sql`AND id NOT IN (${Prisma.join(excludeGameIds)})` : Prisma.empty}
        ORDER BY embedding <-> (SELECT embedding FROM "Game" WHERE id = ${seedGameId})
        LIMIT ${limit}
      `;
    }

    const recommendedIds = vectorResults.map(v => v.id);

    if (recommendedIds.length === 0) {
      return NextResponse.json({ games: [], reason: null });
    }

    // Fetch the full game objects with relations using Prisma
    const recommendedGames = await db.game.findMany({
      where: { id: { in: recommendedIds } },
      include: {
        developers: true,
        genres: true,
        tags: true,
        platforms: true,
      }
    });

    // Sort them back to the vector distance order
    const sortedGames = recommendedGames.sort((a, b) => recommendedIds.indexOf(a.id) - recommendedIds.indexOf(b.id));

    return NextResponse.json({
      games: sortedGames,
      reason: reasonString,
    });
    
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
