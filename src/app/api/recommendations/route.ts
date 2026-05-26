import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerUser } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "4");
    
    // Default values
    let topTags: string[] = [];
    let excludeGameIds: string[] = [];
    let reasonString = "Personalized for you";

    // 1. Try to get logged-in user signals first
    const user = await getServerUser();
    
    if (user) {
      // Fetch wishlist and collection to determine top genres/tags
      const wishlist = await db.wishlist.findMany({
        where: { userId: user.id },
        include: { game: { include: { tags: true, genres: true } } }
      });
      
      const collection = await db.collection.findMany({
        where: { userId: user.id },
        include: { game: { include: { tags: true, genres: true } } }
      });

      const affinityScores: Record<string, { name: string, score: number }> = {};
      
      // Wishlist = +10 weight
      wishlist.forEach(w => {
        excludeGameIds.push(w.gameId);
        w.game.tags.forEach(t => {
          if (!affinityScores[t.slug]) affinityScores[t.slug] = { name: t.name, score: 0 };
          affinityScores[t.slug].score += 10;
        });
        w.game.genres.forEach(g => {
          if (!affinityScores[g.slug]) affinityScores[g.slug] = { name: g.name, score: 0 };
          affinityScores[g.slug].score += 10;
        });
      });

      // Collection = +15 weight
      collection.forEach(c => {
        excludeGameIds.push(c.gameId);
        c.game.tags.forEach(t => {
          if (!affinityScores[t.slug]) affinityScores[t.slug] = { name: t.name, score: 0 };
          affinityScores[t.slug].score += 15;
        });
        c.game.genres.forEach(g => {
          if (!affinityScores[g.slug]) affinityScores[g.slug] = { name: g.name, score: 0 };
          affinityScores[g.slug].score += 15;
        });
      });

      const sortedAffinities = Object.entries(affinityScores)
        .sort((a, b) => b[1].score - a[1].score);

      if (sortedAffinities.length > 0) {
        topTags = sortedAffinities.slice(0, 3).map(a => a[0]);
        reasonString = `Based on your interest in ${sortedAffinities[0][1].name}`;
      }
    }

    // 2. Fallback to client-side affinities if no user or no items in lists
    if (topTags.length === 0) {
      const clientTagsParam = searchParams.get("tags");
      if (clientTagsParam) {
        topTags = clientTagsParam.split(",").filter(t => t.trim() !== "");
        if (topTags.length > 0) {
          const mainTag = topTags[0].replace(/-/g, ' ');
          reasonString = `Because you explored ${mainTag}`;
        }
      }
    }

    // 3. If still no tags, we can't provide dynamic recommendations, return empty
    if (topTags.length === 0) {
      return NextResponse.json({ games: [], reason: null });
    }

    // 4. Query games that match the top tags and are not in the exclude list
    const recommendedGames = await db.game.findMany({
      where: {
        id: { notIn: excludeGameIds },
        OR: [
          { tags: { some: { slug: { in: topTags } } } },
          { genres: { some: { slug: { in: topTags } } } },
        ]
      },
      take: limit,
      orderBy: [
        { rating: 'desc' },
        { releaseDate: 'desc' }
      ],
      include: {
        developers: true,
        genres: true,
        tags: true,
        platforms: true,
      }
    });

    return NextResponse.json({
      games: recommendedGames,
      reason: reasonString,
    });
    
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
