import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { preprocessSearchQuery } from "@/lib/searchEngine";

export const dynamic = "force-dynamic";

const gameSelect = {
  id: true,
  title: true,
  slug: true,
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
};

async function fetchCheapestSnapshots(gameIds: string[]) {
  if (gameIds.length === 0) return new Map<string, any[]>();
  const rows = await db.$queryRaw<{
    gameId: string;
    storeName: string;
    dealPrice: number;
    retailPrice: number;
    discountPercent: number;
    dealUrl: string;
    currency: string;
    country: string;
  }[]>`
    SELECT "gameId", "storeName", "dealPrice", "retailPrice", "discountPercent", "dealUrl", "currency", "country"
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY "gameId" ORDER BY "dealPrice" ASC)::int as rn
      FROM "PriceSnapshot"
      WHERE "gameId" IN (${Prisma.join(gameIds)})
    ) sub
    WHERE rn <= 3
  `;
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const { gameId, ...snapshot } = row;
    if (!grouped.has(gameId)) grouped.set(gameId, []);
    grouped.get(gameId)!.push(snapshot);
  }
  return grouped;
}

export async function GET(request: NextRequest) {
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
    const sort = searchParams.get("sort")?.trim() || "latest";
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

    let matchedIds: string[] = [];
    let semanticExtractedSlugs: string[] = [];

    if (search) {
      if (mode === "semantic") {
        const { cleanedQuery, expandedQuery, extractedSlugs } = preprocessSearchQuery(search);
        semanticExtractedSlugs = extractedSlugs;

        const ftsMatches = await db.$queryRaw<{ id: string }[]>(
          Prisma.sql`
            SELECT id FROM "Game"
            WHERE to_tsvector('english', unaccent(title) || ' ' || COALESCE(unaccent(summary), '')) @@ plainto_tsquery('english', unaccent(${expandedQuery || cleanedQuery}))
               OR similarity(title, ${cleanedQuery}) > 0.18
               OR regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(${cleanedQuery})), '[^a-z0-9]', '', 'g')
               OR similarity(regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(${cleanedQuery})), '[^a-z0-9]', '', 'g')) > 0.18
            ORDER BY GREATEST(
              CASE WHEN regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(${cleanedQuery})), '[^a-z0-9]', '', 'g') THEN 1.0 ELSE 0.0 END,
              similarity(title, ${cleanedQuery}),
              similarity(regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(${cleanedQuery})), '[^a-z0-9]', '', 'g'))
            ) DESC
            LIMIT 100;
          `
        );

        matchedIds = ftsMatches.map(match => match.id);

      } else {
        const rawMatches = await db.$queryRaw<{ id: string }[]>(
          Prisma.sql`
            SELECT id FROM "Game"
            WHERE to_tsvector('english', unaccent(title) || ' ' || COALESCE(unaccent(summary), '')) @@ plainto_tsquery('english', unaccent(${search}))
               OR similarity(title, ${search}) > 0.18
               OR similarity(coalesce("developerNames", ''), ${search}) > 0.2
               OR similarity(coalesce("genreNames", ''), ${search}) > 0.2
               OR similarity(coalesce("platformNames", ''), ${search}) > 0.2
               OR regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(${search})), '[^a-z0-9]', '', 'g')
               OR similarity(regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(${search})), '[^a-z0-9]', '', 'g')) > 0.18
            ORDER BY GREATEST(
              CASE WHEN regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(${search})), '[^a-z0-9]', '', 'g') THEN 1.0 ELSE 0.0 END,
              similarity(title, ${search}),
              similarity(regexp_replace(lower(unaccent(title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(${search})), '[^a-z0-9]', '', 'g')),
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

    let games: any[] = [];
    let nextCursor: string | null = null;

    if (search) {
      const allSearchGames = await db.game.findMany({
        where,
        select: gameSelect,
      });

      if (matchedIds.length > 0) {
        allSearchGames.sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
      }

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
    } else if (sort === "random") {
      games = await db.game.findMany({
        where,
        select: gameSelect,
        take: limit,
      });
      if (matchedIds.length > 0) {
        games.sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
      }
      nextCursor = "more-random";
    } else {
      let cursorFilter: Prisma.GameWhereInput = {};
      if (cursor && sort !== "trending") {
        const sep = cursor.lastIndexOf("_");
        const cursorVal = cursor.substring(0, sep);
        const cursorId = cursor.substring(sep + 1);

        if (sort === "top-rated") {
          cursorFilter = cursorVal === "null"
            ? { AND: [{ rating: null }, { id: { lt: cursorId } }] }
            : { OR: [{ rating: { lt: parseFloat(cursorVal) } }, { rating: parseFloat(cursorVal), id: { lt: cursorId } }] };
        } else {
          cursorFilter = cursorVal === "null"
            ? { AND: [{ releaseDate: null }, { id: { lt: cursorId } }] }
            : { OR: [{ releaseDate: { lt: new Date(parseInt(cursorVal, 10)) } }, { releaseDate: new Date(parseInt(cursorVal, 10)), id: { lt: cursorId } }] };
        }
      }

      const fetchedGames = await db.game.findMany({
        take: limit + 1,
        where: cursor ? { AND: [where, cursorFilter] } : where,
        select: gameSelect,
        orderBy: sort === "trending"
          ? [{ isTrending: "desc" }, { popularity: { sort: "desc", nulls: "last" } }, { id: "desc" }]
          : sort === "top-rated"
          ? [{ rating: { sort: "desc", nulls: "last" } }, { id: "desc" }]
          : [{ releaseDate: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      });

      if (fetchedGames.length > limit) {
        const nextItem = fetchedGames.pop()!;
        if (sort === "trending") {
          nextCursor = nextItem.id;
        } else if (sort === "top-rated") {
          nextCursor = `${nextItem.rating ?? "null"}_${nextItem.id}`;
        } else {
          nextCursor = `${nextItem.releaseDate ? nextItem.releaseDate.getTime() : "null"}_${nextItem.id}`;
        }
      }
      games = fetchedGames;
    }

    const gameIds = games.map((g: any) => g.id);
    const snapshotMap = await fetchCheapestSnapshots(gameIds);
    for (const game of games) {
      game.priceSnapshots = snapshotMap.get(game.id) || [];
    }

    return NextResponse.json(
      { games, nextCursor },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Failed to fetch games from database:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch games from database" },
      { status: 500 }
    );
  }
}
