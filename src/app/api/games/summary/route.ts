import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Cache for the summary data
interface CacheEntry {
  data: any;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(request: Request) {
  const cacheKey = request.url;
  const cached = apiCache.get(cacheKey);

  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const tagsParam = searchParams.get("tags")?.trim() || "";
    const tag = searchParams.get("tag")?.trim() || "";
    const activeTagsString = tagsParam || tag;
    const selectedTags = activeTagsString
      ? activeTagsString.split(",").map(t => t.trim()).filter(Boolean)
      : [];
    const cursor = searchParams.get("cursor")?.trim() || "";
    const sort = searchParams.get("sort")?.trim() || "latest"; // "latest" | "trending" | "random"
    const creatorIdsParam = searchParams.get("creatorIds")?.trim() || "";
    const excludeId = searchParams.get("excludeId")?.trim() || "";
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "5000", 10) || 5000, 1), 5000); // Default higher limit for index

    // Minimal fields for client-side MiniSearch index
    const gameSummarySelect = {
      id: true,
      title: true,
      slug: true,
      coverUrl: true,
      releaseDate: true,
      rating: true,
      genreNames: true,
      platformNames: true,
      priceSnapshots: true,
      tags: { select: { name: true, slug: true } },
    };

    const where: Prisma.GameWhereInput = {};

    if (excludeId) {
      where.id = { not: excludeId };
    }

    if (creatorIdsParam) {
      const creatorIds = creatorIdsParam.split(",").filter(Boolean);
      if (creatorIds.length > 0) {
        where.OR = [
          { developers: { some: { id: { in: creatorIds } } } },
          { publishers: { some: { id: { in: creatorIds } } } }
        ];
      }
    }

    // 1. Tag Filtering (Filter by Mood Tag slug)
    if (selectedTags.length > 0) {
      where.AND = selectedTags.map(tagSlug => ({
        tags: {
          some: {
            slug: tagSlug
          }
        }
      }));
    }

    let games: any[] = [];
    let nextCursor: string | null = null;
    let totalCount = 0;

    const queryOptions: any = {
      where,
      select: gameSummarySelect,
      take: limit + 1, // Fetch one extra item to determine if there's a next page
      orderBy:
        sort === "trending"
          ? [
              { isTrending: "desc" },
              { popularity: { sort: "desc", nulls: "last" } },
              { id: "desc" },
            ]
          : sort === "top-rated"
          ? [
              { rating: { sort: "desc", nulls: "last" } },
              { id: "desc" }
            ]
          : {
              releaseDate: "desc",
            },
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    }

    // 2. Query Execution with Cursor Pagination
    const [fetchedGames, count] = await Promise.all([
      db.game.findMany(queryOptions),
      db.game.count({ where })
    ]);
    totalCount = count;

    games = fetchedGames.slice(0, limit);
    if (fetchedGames.length > limit) {
      nextCursor = games[games.length - 1]?.id || null;
    }

    const responseData = {
      games,
      nextCursor,
      totalCount,
    };

    apiCache.set(cacheKey, { data: responseData, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("Error fetching game summaries:", error);
    return NextResponse.json({ error: "Failed to fetch game summaries" }, { status: 500 });
  }
}
