import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

interface CacheEntry {
  data: any;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const cacheKey = request.url;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return new NextResponse(JSON.stringify(cached.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600"
      }
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
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
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 100);

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

    let matchedIds: string[] = [];

    // 2. Server-side Search or Random filtering
    if (search) {
      const rawMatches = await db.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT id FROM "Game"
          WHERE to_tsvector('english', unaccent(title) || ' ' || COALESCE(unaccent(summary), '')) @@ plainto_tsquery('english', unaccent(${search}))
             OR similarity(title, ${search}) > 0.18
             OR similarity(coalesce("developerNames", ''), ${search}) > 0.2
             OR similarity(coalesce("genreNames", ''), ${search}) > 0.2
             OR similarity(coalesce("platformNames", ''), ${search}) > 0.2
          ORDER BY GREATEST(
            similarity(title, ${search}),
            similarity(coalesce("developerNames", ''), ${search})
          ) DESC
          LIMIT 100;
        `
      );
      matchedIds = rawMatches.map(m => m.id);
      where.id = where.id && (where.id as any).not 
        ? { in: matchedIds, not: (where.id as any).not } 
        : { in: matchedIds };
    } else if (sort === "random") {
      let rawMatches;
      if (selectedTags.length > 0) {
        rawMatches = await db.$queryRaw<{ id: string }[]>(
          Prisma.sql`
            SELECT g.id FROM "Game" g
            JOIN "_GameToTag" gt ON g.id = gt."A"
            JOIN "Tag" t ON gt."B" = t.id
            WHERE t.slug IN (${Prisma.join(selectedTags)})
            GROUP BY g.id
            HAVING COUNT(DISTINCT t.slug) = ${selectedTags.length}
            ORDER BY random()
            LIMIT ${limit};
          `
        );
      } else {
        rawMatches = await db.$queryRaw<{ id: string }[]>(
          Prisma.sql`
            SELECT id FROM "Game"
            ORDER BY random()
            LIMIT ${limit};
          `
        );
      }
      matchedIds = rawMatches.map(m => m.id);
      where.id = where.id && (where.id as any).not 
        ? { in: matchedIds, not: (where.id as any).not } 
        : { in: matchedIds };
    }

    // 3. Query Execution with Cursor Pagination
    let games: any[] = [];
    let nextCursor: string | null = null;
    let totalCount = 0;

    if (search) {
      const [allSearchGames, count] = await Promise.all([
        db.game.findMany({
          where,
          include: {
            tags: true,
            developers: true,
            platforms: true,
            genres: true,
          },
        }),
        db.game.count()
      ]);
      totalCount = count;

      // Sort by similarity order
      if (matchedIds.length > 0) {
        allSearchGames.sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
      }

      // Paginate in memory
      let paginatedGames = allSearchGames;
      if (cursor) {
        const cursorIndex = allSearchGames.findIndex(g => g.id === cursor);
        if (cursorIndex !== -1) {
          paginatedGames = allSearchGames.slice(cursorIndex + 1);
        }
      }

      games = paginatedGames.slice(0, limit);
      if (paginatedGames.length > limit) {
        nextCursor = games[games.length - 1].id;
      }
    } else {
      const [fetchedGames, count] = await Promise.all([
        db.game.findMany({
          take: sort === "random" ? limit : limit + 1, // For random, we already limited in raw query
          ...(sort !== "random" && cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          where,
          include: {
            tags: true,
            developers: true,
            platforms: true,
            genres: true,
          },
          orderBy: sort === "trending"
            ? [
                { rating: { sort: "desc", nulls: "last" } },
                { id: "desc" }
              ]
            : {
                releaseDate: "desc",
              },
        }),
        db.game.count()
      ]);
      totalCount = count;

      if (sort === "random") {
        nextCursor = "more-random";
        games = fetchedGames;
        if (matchedIds.length > 0) {
          games.sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
        }
      } else {
        if (fetchedGames.length > limit) {
          const nextItem = fetchedGames.pop();
          nextCursor = nextItem ? nextItem.id : null;
        }
        games = fetchedGames;
      }
    }

    const responseData = {
      games,
      nextCursor,
      totalCount
    };

    apiCache.set(cacheKey, {
      data: responseData,
      expiry: Date.now() + CACHE_TTL_MS
    });

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    console.error("❌ Failed to fetch games from database:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch games from database" },
      { status: 500 }
    );
  }
}
