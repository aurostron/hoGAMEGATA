import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { preprocessSearchQuery, embedQuery } from "@/lib/searchEngine";

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
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const mode = searchParams.get("mode")?.trim() || "exact";
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

    const gameSelect = {
      id: true,
      title: true,
      slug: true,
      summary: true,
      status: true,
      coverUrl: true,
      isTrending: true,
      rating: true,
      category: true,
      esrbRating: true,
      pegiRating: true,
      developerNames: true,
      genreNames: true,
      platformNames: true,
      releaseDate: true,
      tags: { select: { name: true, slug: true } },
      priceSnapshots: true,
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

    let matchedIds: string[] = [];
    let semanticExtractedSlugs: string[] = [];

    // 2. Server-side Search or Random filtering
    if (search) {
      if (mode === "semantic") {
        // Preprocess search query: extract tag constraints and expand vocabulary
        const { cleanedQuery, expandedQuery, extractedSlugs } = preprocessSearchQuery(search);
        semanticExtractedSlugs = extractedSlugs;

        // Perform FTS keyword search
        const ftsMatches = await db.$queryRaw<{ id: string }[]>(
          Prisma.sql`
            SELECT id FROM "Game"
            WHERE to_tsvector('english', unaccent(title) || ' ' || COALESCE(unaccent(summary), '')) @@ plainto_tsquery('english', unaccent(${cleanedQuery}))
               OR similarity(title, ${cleanedQuery}) > 0.18
            ORDER BY similarity(title, ${cleanedQuery}) DESC
            LIMIT 100;
          `
        );

        // Perform pgvector similarity search
        let vectorMatches: { id: string }[] = [];
        try {
          const queryVector = await embedQuery(expandedQuery || cleanedQuery || search);
          if (queryVector && queryVector.length > 0) {
            const vectorString = `[${queryVector.join(",")}]`;
            vectorMatches = await db.$queryRawUnsafe<{ id: string }[]>(
              `SELECT id FROM "Game" WHERE embedding IS NOT NULL ORDER BY embedding <-> '${vectorString}'::vector LIMIT 100;`
            );
          }
        } catch (embedErr) {
          console.error("❌ Semantic embedding search failed:", embedErr);
        }

        // Combine using Reciprocal Rank Fusion (RRF) with constant k=60
        const rrfScores = new Map<string, number>();
        const k = 60;

        ftsMatches.forEach((match, index) => {
          const rank = index + 1;
          rrfScores.set(match.id, (rrfScores.get(match.id) || 0) + 1 / (k + rank));
        });

        vectorMatches.forEach((match, index) => {
          const rank = index + 1;
          rrfScores.set(match.id, (rrfScores.get(match.id) || 0) + 1 / (k + rank));
        });

        matchedIds = Array.from(rrfScores.entries())
          .sort((a, b) => b[1] - a[1])
          .map(entry => entry[0]);

      } else {
        // Standard FTS / Exact query match
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
      }

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

    // 1. Tag Filtering (Filter by Mood Tag slug + extracted semantic slugs)
    const combinedTags = [...selectedTags, ...semanticExtractedSlugs];
    if (combinedTags.length > 0) {
      where.AND = combinedTags.map(tagSlug => ({
        tags: {
          some: {
            slug: tagSlug
          }
        }
      }));
    }

    // 3. Query Execution with Cursor Pagination
    let games: any[] = [];
    let nextCursor: string | null = null;
    let totalCount = 0;

    if (search) {
      const [allSearchGames, count] = await Promise.all([
        db.game.findMany({
          where,
          select: gameSelect,
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
          select: gameSelect,
          orderBy: sort === "trending"
            ? [
                { isTrending: "desc" },
                { popularity: { sort: "desc", nulls: "last" } },
                { id: "desc" }
              ]
            : sort === "top-rated"
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

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("❌ Failed to fetch games from database:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch games from database" },
      { status: 500 }
    );
  }
}
