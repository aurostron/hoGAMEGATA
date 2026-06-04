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
    return NextResponse.json(cached.data);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const tag = searchParams.get("tag")?.trim() || "";
    const cursor = searchParams.get("cursor")?.trim() || "";
    const sort = searchParams.get("sort")?.trim() || "latest"; // "latest" | "trending" | "random"
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 100);

    const where: Prisma.GameWhereInput = {};

    // 1. Tag Filtering (Filter by Mood Tag slug)
    if (tag) {
      where.tags = {
        some: {
          slug: tag
        }
      };
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
      where.id = { in: matchedIds };
    } else if (sort === "random") {
      let rawMatches;
      if (tag) {
        rawMatches = await db.$queryRaw<{ id: string }[]>(
          Prisma.sql`
            SELECT g.id FROM "Game" g
            JOIN "_GameToTag" gt ON g.id = gt."A"
            JOIN "Tag" t ON gt."B" = t.id
            WHERE t.slug = ${tag}
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
      where.id = { in: matchedIds };
    }

    // 3. Query Execution with Cursor Pagination
    const [games, totalCount] = await Promise.all([
      db.game.findMany({
        take: sort === "random" ? limit : limit + 1, // For random, we already limited in raw query
        ...(!search && sort !== "random" && cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where,
        include: {
          tags: true,
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

    // If searching or random, sort in-memory to preserve similarity/random query order
    if ((search || sort === "random") && matchedIds.length > 0) {
      games.sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
    }

    let nextCursor: string | null = null;
    if (sort === "random") {
      nextCursor = "more-random";
    } else if (games.length > limit) {
      const nextItem = games.pop(); // Pop the extra element and set as next cursor
      nextCursor = nextItem ? nextItem.id : null;
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

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("❌ Failed to fetch games from database:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch games from database", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
