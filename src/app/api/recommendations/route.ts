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

    // 4. Query precomputed recommendations from the database
    let recommendations;
    
    if (searchParams.get("tags") && !user) {
      // If filtering by specific vibes, enforce tag/genre filter
      const topTag = searchParams.get("tags")!.split(",")[0].trim();
      recommendations = await db.gameRecommendation.findMany({
        where: {
          gameId: seedGameId,
          recommendedGameId: { notIn: excludeGameIds.length > 0 ? excludeGameIds : undefined },
          recommendedGame: {
            OR: [
              { tags: { some: { slug: topTag } } },
              { genres: { some: { slug: topTag } } }
            ]
          }
        },
        orderBy: { distance: 'asc' },
        take: limit,
        include: {
          recommendedGame: {
            include: {
              developers: true,
              genres: true,
              tags: true,
              platforms: true,
            }
          }
        }
      });
    } else {
      // General personalized recommendations
      recommendations = await db.gameRecommendation.findMany({
        where: {
          gameId: seedGameId,
          recommendedGameId: { notIn: excludeGameIds.length > 0 ? excludeGameIds : undefined }
        },
        orderBy: { distance: 'asc' },
        take: limit,
        include: {
          recommendedGame: {
            include: {
              developers: true,
              genres: true,
              tags: true,
              platforms: true,
            }
          }
        }
      });
    }

    const recommendedGames = recommendations.map(r => r.recommendedGame);

    if (recommendedGames.length === 0) {
      return NextResponse.json({ games: [], reason: null });
    }

    return NextResponse.json({
      games: recommendedGames,
      reason: reasonString,
    });
    
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
