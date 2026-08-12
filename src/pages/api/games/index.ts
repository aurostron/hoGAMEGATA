import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import {
  games as gamesTable,
  developers as developersTable,
  gamesToDevelopers,
  publishers as publishersTable,
  gamesToPublishers,
  tags as tagsTable,
  gamesToTags,
  genres as genresTable,
  gamesToGenres,
  priceSnapshots as priceSnapshotsTable,
  platforms as platformsTable,
  gamesToPlatforms
} from '../../../db/schema';
import { enrichGamesWithRelations } from '../../../lib/gameQueries';
import { count, isNull, isNotNull, desc, asc, and, or, eq, gt, gte, lt, lte, inArray, like, ne, sql } from 'drizzle-orm';
import { expandAbbreviations, suggestCorrection } from '../../../lib/searchEngine';
import { trackSearch } from '../../../lib/analytics';

export const prerender = false;

let cachedGameTitles: string[] | null = null;
async function getGameTitles(): Promise<string[]> {
  if (cachedGameTitles) return cachedGameTitles;
  try {
    const rows = await turso
      .select({ title: gamesTable.title })
      .from(gamesTable)
      .orderBy(desc(gamesTable.popularity))
      .limit(1000);
    cachedGameTitles = rows.map(r => r.title).filter(Boolean);
    return cachedGameTitles;
  } catch (err) {
    console.error("Failed to fetch game titles for spelling correction:", err);
    return [];
  }
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    
    if (search) {
      await trackSearch(search);
    }
    
    // Advanced Filters
    const genresParam = searchParams.get("genres")?.trim() || "";
    const selectedGenres = genresParam ? genresParam.split(",").map(g => g.trim()).filter(Boolean) : [];
    
    const systemsParam = searchParams.get("systems")?.trim() || "";
    const selectedSystems = systemsParam ? systemsParam.split(",").map(s => s.trim()).filter(Boolean) : [];
    
    const decadesParam = (searchParams.get("decades") || searchParams.get("releaseDecades"))?.trim() || "";
    const selectedDecades = decadesParam ? decadesParam.split(",").map(d => d.trim()).filter(Boolean) : [];
    
    const featuresParam = searchParams.get("features")?.trim() || "";
    const selectedFeatures = featuresParam ? featuresParam.split(",").map(f => f.trim()).filter(Boolean) : [];
    
    const tagsParam = searchParams.get("tags")?.trim() || "";
    const tag = searchParams.get("tag")?.trim() || "";
    const activeTagsString = tagsParam || tag;
    const selectedTags = activeTagsString
      ? activeTagsString.split(",").map(t => t.trim()).filter(Boolean)
      : [];
    
    // Combine selected tags and features
    const allActiveTags = Array.from(new Set([...selectedTags, ...selectedFeatures]));

    const hideDlcs = searchParams.get("hideDlcs") === "true";
    const freeOnly = searchParams.get("freeOnly") === "true";
    
    const minPriceParam = searchParams.get("minPrice")?.trim() || "";
    const maxPriceParam = searchParams.get("maxPrice")?.trim() || "";

    const cursor = searchParams.get("cursor")?.trim() || "";
    const sort = searchParams.get("sort")?.trim() || "trending";
    const creatorIdsParam = searchParams.get("creatorIds")?.trim() || "";
    const excludeId = searchParams.get("excludeId")?.trim() || "";
    
    // Pagination offset & limit
    const limitParam = searchParams.get("limit");
    const maxLimit = sort === "title" ? 500 : 120;
    const limit = Math.min(Math.max(parseInt(limitParam || "24", 10) || 24, 1), maxLimit);
    
    const offsetParam = searchParams.get("offset")?.trim() || "";
    let offset = Math.max(parseInt(offsetParam, 10) || 0, 0);
    if (cursor) {
      const parts = cursor.split("_");
      const parsedOffset = parseInt(parts[0], 10);
      if (!isNaN(parsedOffset)) {
        offset = parsedOffset;
      }
    }

    // 1. Resolve Creator IDs Filter
    let creatorGameIds: string[] | null = null;
    if (creatorIdsParam) {
      const creatorIds = creatorIdsParam.split(",").filter(Boolean);
      if (creatorIds.length > 0) {
        const [devGames, pubGames] = await Promise.all([
          turso
            .select({ gameId: gamesToDevelopers.gameId })
            .from(gamesToDevelopers)
            .where(inArray(gamesToDevelopers.developerId, creatorIds)),
          turso
            .select({ gameId: gamesToPublishers.gameId })
            .from(gamesToPublishers)
            .where(inArray(gamesToPublishers.publisherId, creatorIds))
        ]);
        creatorGameIds = Array.from(new Set([
          ...devGames.map(dg => dg.gameId),
          ...pubGames.map(pg => pg.gameId)
        ]));
      }
    }

    // 2. Resolve Tag/Feature Slugs Filter (AND logic)
    let tagGameIds: string[] | null = null;
    if (allActiveTags.length > 0) {
      const matchedTags = await turso
        .select({ id: tagsTable.id })
        .from(tagsTable)
        .where(inArray(tagsTable.slug, allActiveTags));

      const tagIds = matchedTags.map(t => t.id);
      if (tagIds.length === 0) {
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const rows = await turso
        .select({ gameId: gamesToTags.gameId, tagId: gamesToTags.tagId })
        .from(gamesToTags)
        .where(inArray(gamesToTags.tagId, tagIds));

      const tagCounts = new Map<string, number>();
      for (const r of rows) {
        tagCounts.set(r.gameId, (tagCounts.get(r.gameId) || 0) + 1);
      }

      tagGameIds = Array.from(tagCounts.entries())
        .filter(([_, count]) => count >= tagIds.length)
        .map(([id]) => id);
      
      if (tagGameIds.length === 0) {
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Resolve Genre Slugs Filter (OR logic)
    let genreGameIds: string[] | null = null;
    if (selectedGenres.length > 0) {
      const matchedGenres = await turso
        .select({ id: genresTable.id })
        .from(genresTable)
        .where(inArray(genresTable.slug, selectedGenres));
      const genreIds = matchedGenres.map(g => g.id);
      if (genreIds.length === 0) {
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const rows = await turso
        .select({ gameId: gamesToGenres.gameId })
        .from(gamesToGenres)
        .where(inArray(gamesToGenres.genreId, genreIds));
      
      genreGameIds = Array.from(new Set(rows.map(r => r.gameId)));
      if (genreGameIds.length === 0) {
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 3.5. Resolve Platform Filter
    let platformGameIds: string[] | null = null;
    if (selectedSystems.length > 0) {
      const platformConds = [];
      for (const sys of selectedSystems) {
        if (sys === "win") {
          platformConds.push(
            like(platformsTable.slug, "%win%"),
            like(platformsTable.slug, "%pc%"),
            like(platformsTable.slug, "%windows%")
          );
        } else if (sys === "mac") {
          platformConds.push(
            like(platformsTable.slug, "%mac%"),
            like(platformsTable.slug, "%os-x%"),
            like(platformsTable.slug, "%macos%")
          );
        } else if (sys === "linux") {
          platformConds.push(
            like(platformsTable.slug, "%linux%")
          );
        }
      }
      const matchedPlatforms = await turso
        .select({ id: platformsTable.id })
        .from(platformsTable)
        .where(or(...platformConds));
      
      const platformIds = matchedPlatforms.map(p => p.id);
      if (platformIds.length > 0) {
        const platformGames = await turso
          .select({ gameId: gamesToPlatforms.gameId })
          .from(gamesToPlatforms)
          .where(inArray(gamesToPlatforms.platformId, platformIds));
        
        platformGameIds = Array.from(new Set(platformGames.map(pg => pg.gameId)));
        if (platformGameIds.length === 0) {
          return new Response(
            JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Intersect Filter IDs
    let filterGameIds: string[] | null = null;
    const activeFilters = [creatorGameIds, tagGameIds, genreGameIds, platformGameIds].filter(f => f !== null) as string[][];
    if (activeFilters.length > 0) {
      // Find intersection of all active filter lists
      filterGameIds = activeFilters.reduce((a, b) => a.filter(id => b.includes(id)));
      if (filterGameIds.length === 0) {
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Pre-fetch game IDs matching developers or publishers by name (only on catalog searches or 3+ char terms)
    let searchGameIds: string[] = [];
    if (search.trim() && (limit > 10 || search.trim().length >= 3)) {
      const searchTerm = search.trim();
      try {
        // 1. Search Developers
        const matchedDevs = await turso
          .select({ id: developersTable.id })
          .from(developersTable)
          .where(like(developersTable.name, `%${searchTerm}%`));
        
        const devIds = matchedDevs.map(d => d.id);
        let devGameIds: string[] = [];
        if (devIds.length > 0) {
          const devRows = await turso
            .select({ gameId: gamesToDevelopers.gameId })
            .from(gamesToDevelopers)
            .where(inArray(gamesToDevelopers.developerId, devIds));
          devGameIds = devRows.map(r => r.gameId);
        }

        // 2. Search Publishers
        const matchedPubs = await turso
          .select({ id: publishersTable.id })
          .from(publishersTable)
          .where(like(publishersTable.name, `%${searchTerm}%`));
        
        const pubIds = matchedPubs.map(p => p.id);
        let pubGameIds: string[] = [];
        if (pubIds.length > 0) {
          const pubRows = await turso
            .select({ gameId: gamesToPublishers.gameId })
            .from(gamesToPublishers)
            .where(inArray(gamesToPublishers.publisherId, pubIds));
          pubGameIds = pubRows.map(r => r.gameId);
        }
        
        searchGameIds = Array.from(new Set([...devGameIds, ...pubGameIds]));
      } catch (err) {
        console.error("Failed to query devs/publishers for search:", err);
      }
    }

    // 6. Search Preprocessing & Correction
    let finalSearch = search;
    let correctedQuery: string | null = null;

    const expandedAbbr = expandAbbreviations(search);
    if (expandedAbbr) {
      finalSearch = expandedAbbr;
    }

    const buildConditions = (searchTerm: string, activeFilterIds: string[] | null) => {
      const conds = [];
      
      // Filter out hidden games
      conds.push(ne(gamesTable.status, "hidden"));
      
      const todayDate = new Date();
      if (sort === "upcoming") {
        conds.push(
          or(
            eq(gamesTable.status, "upcoming"),
            gt(gamesTable.releaseDate, todayDate)
          )
        );
      } else {
        conds.push(
          and(
            ne(gamesTable.status, "upcoming"),
            lte(gamesTable.releaseDate, todayDate)
          )
        );
      }

      if (excludeId) {
        conds.push(ne(gamesTable.id, excludeId));
      }
      if (activeFilterIds !== null) {
        conds.push(inArray(gamesTable.id, activeFilterIds));
      }
      if (minPriceParam || maxPriceParam) {
        const minPrice = parseFloat(minPriceParam || "0") || 0;
        const maxPrice = parseFloat(maxPriceParam || "999999") || 999999;
        conds.push(
          inArray(
            gamesTable.id,
            turso
              .select({ gameId: priceSnapshotsTable.gameId })
              .from(priceSnapshotsTable)
              .where(and(
                sql`${priceSnapshotsTable.dealPrice} >= ${minPrice}`,
                sql`${priceSnapshotsTable.dealPrice} <= ${maxPrice}`
              ))
          )
        );
      }
      const idsParam = searchParams.get("ids")?.trim() || "";
      if (idsParam) {
        const idsList = idsParam.split(",").map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
        if (idsList.length > 0) {
          conds.push(inArray(gamesTable.id, idsList));
        }
      }

      if (searchTerm) {
        const searchOrConds = [
          like(gamesTable.title, `%${searchTerm}%`),
          like(gamesTable.developerNames, `%${searchTerm}%`),
          like(gamesTable.slug, `%${searchTerm}%`)
        ];
        if (searchGameIds.length > 0) {
          searchOrConds.push(inArray(gamesTable.id, searchGameIds));
        }
        conds.push(or(...searchOrConds));
      }
      if (hideDlcs) {
        conds.push(or(isNull(gamesTable.category), sql`${gamesTable.category} NOT IN (1, 2, 3, 10, 13)`));
      }
      if (freeOnly) {
        conds.push(
          inArray(
            gamesTable.id,
            turso
              .select({ gameId: priceSnapshotsTable.gameId })
              .from(priceSnapshotsTable)
              .where(eq(priceSnapshotsTable.dealPrice, 0))
          )
        );
      }

      if (selectedDecades.length > 0) {
        const decConds = selectedDecades.map(dec => {
          if (dec === "2020s") return and(gte(gamesTable.releaseDate, new Date("2020-01-01")), lt(gamesTable.releaseDate, new Date("2030-01-01")));
          if (dec === "2010s") return and(gte(gamesTable.releaseDate, new Date("2010-01-01")), lt(gamesTable.releaseDate, new Date("2020-01-01")));
          if (dec === "2000s") return and(gte(gamesTable.releaseDate, new Date("2000-01-01")), lt(gamesTable.releaseDate, new Date("2010-01-01")));
          if (dec === "1990s") return and(gte(gamesTable.releaseDate, new Date("1990-01-01")), lt(gamesTable.releaseDate, new Date("2000-01-01")));
          if (dec === "1980s" || dec === "older") return lt(gamesTable.releaseDate, new Date("1990-01-01"));
          return null;
        }).filter(Boolean);
        if (decConds.length > 0) conds.push(or(...decConds));
      }
      return conds;
    };

    let conditions = buildConditions(finalSearch, filterGameIds);

    // Get Total Matching Count
    let countQuery = turso.select({ count: count() }).from(gamesTable);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    let [{ count: totalCount }] = await countQuery;

    // Run Typo Correction if no results found
    if (totalCount === 0 && finalSearch && finalSearch.length > 3) {
      const allTitles = await getGameTitles();
      const correction = suggestCorrection(finalSearch, allTitles);
      if (correction && correction.toLowerCase() !== finalSearch.toLowerCase()) {
        correctedQuery = correction;
        finalSearch = correction;
        conditions = buildConditions(finalSearch, filterGameIds);
        const [{ count: newCount }] = await turso
          .select({ count: count() })
          .from(gamesTable)
          .where(and(...conditions));
        totalCount = newCount;
      }
    }

    // Query Max Price in DB (for slider ranges)
    let maxPrice = 60;
    try {
      const [maxPriceRow] = await turso
        .select({ maxPrice: sql<number>`max(${priceSnapshotsTable.dealPrice})` })
        .from(priceSnapshotsTable);
      if (maxPriceRow && maxPriceRow.maxPrice) {
        maxPrice = maxPriceRow.maxPrice;
      }
    } catch (err) {
      console.warn("Failed to fetch max price snapshot:", err);
    }

    // 7. Query Games List
    let baseQuery;
    if (sort === "price-asc" || sort === "price-desc") {
      baseQuery = turso
        .select({ game: gamesTable })
        .from(gamesTable)
        .leftJoin(priceSnapshotsTable, eq(priceSnapshotsTable.gameId, gamesTable.id))
        .groupBy(gamesTable.id);
    } else {
      baseQuery = turso.select({ game: gamesTable }).from(gamesTable);
    }

    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    // Define Bayesian rating SQL helper and sources count helper for robust sorting
    const bayesianRatingSql = sql`
      (
        coalesce(case when ${gamesTable.rating} <= 100 then ${gamesTable.rating} else null end, 0) +
        coalesce(${gamesTable.steamRating} * 10, 0) +
        coalesce(${gamesTable.metacritic}, 0) +
        coalesce(${gamesTable.rawgRating} * 20, 0) +
        140.0
      ) / (
        case when ${gamesTable.rating} <= 100 then 1.0 else 0.0 end +
        case when ${gamesTable.steamRating} is not null then 1.0 else 0.0 end +
        case when ${gamesTable.metacritic} is not null then 1.0 else 0.0 end +
        case when ${gamesTable.rawgRating} is not null then 1.0 else 0.0 end +
        2.0
      )
    `;

    const sourcesCountSql = sql`
      (
        case when ${gamesTable.rating} <= 100 then 1 else 0 end +
        case when ${gamesTable.steamRating} is not null then 1 else 0 end +
        case when ${gamesTable.metacritic} is not null then 1 else 0 end +
        case when ${gamesTable.rawgRating} is not null then 1 else 0 end
      )
    `;

    // Apply Sorting (If searching without explicit sort parameter, prioritize title relevance ranking)
    if (search.trim() && !searchParams.has("sort")) {
      const cleanSearch = search.trim().toLowerCase();
      const prefixSearch = `${cleanSearch}%`;
      const substringSearch = `%${cleanSearch}%`;

      baseQuery = baseQuery.orderBy(
        sql`CASE 
          WHEN LOWER(${gamesTable.title}) = ${cleanSearch} THEN 0
          WHEN LOWER(${gamesTable.title}) LIKE ${prefixSearch} THEN 1
          WHEN LOWER(${gamesTable.title}) LIKE ${substringSearch} THEN 2
          ELSE 3
        END ASC`,
        desc(gamesTable.isTrending),
        desc(gamesTable.popularity),
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "trending") {
      baseQuery = baseQuery.orderBy(
        desc(gamesTable.isTrending),
        desc(gamesTable.popularity),
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "top-rated") {
      baseQuery = baseQuery.orderBy(
        desc(gamesTable.rating),
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "upcoming") {
      baseQuery = baseQuery.orderBy(
        asc(gamesTable.releaseDate),
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "title") {
      baseQuery = baseQuery.orderBy(
        sql`${gamesTable.title} COLLATE NOCASE`
      ) as any;
    } else if (sort === "price-asc") {
      baseQuery = baseQuery.orderBy(
        sql`CASE WHEN min(${priceSnapshotsTable.dealPrice}) IS NULL THEN 1 ELSE 0 END`,
        sql`min(${priceSnapshotsTable.dealPrice}) ASC`,
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "price-desc") {
      baseQuery = baseQuery.orderBy(
        sql`CASE WHEN min(${priceSnapshotsTable.dealPrice}) IS NULL THEN 1 ELSE 0 END`,
        sql`min(${priceSnapshotsTable.dealPrice}) DESC`,
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "latest") {
      baseQuery = baseQuery.orderBy(
        desc(gamesTable.releaseDate),
        desc(gamesTable.id)
      ) as any;
    } else {
      // default: trending
      baseQuery = baseQuery.orderBy(
        desc(gamesTable.isTrending),
        desc(gamesTable.popularity),
        desc(gamesTable.id)
      ) as any;
    }

    // Apply Pagination (Limit + Offset)
    let fetchedGames = [];
    let finalQuery = baseQuery.limit(limit);
    if (offset > 0) {
      finalQuery = finalQuery.offset(offset) as any;
    }
    const rows = await finalQuery;
    fetchedGames = rows.map((r: any) => r.game);

    // Enrich with relations (tags, purchase links)
    const enrichedGames = await enrichGamesWithRelations(fetchedGames);

    // Fetch price snapshots for fetched games
    const gameIds = enrichedGames.map((g: any) => g.id);
    const snapshots = gameIds.length > 0
      ? await turso
          .select()
          .from(priceSnapshotsTable)
          .where(inArray(priceSnapshotsTable.gameId, gameIds))
      : [];

    const snapshotMap = new Map<string, any[]>();
    for (const row of snapshots) {
      const { gameId, ...snapshot } = row;
      if (!snapshotMap.has(gameId)) snapshotMap.set(gameId, []);
      snapshotMap.get(gameId)!.push(snapshot);
    }
    for (const game of enrichedGames) {
      game.priceSnapshots = snapshotMap.get(game.id) || [];
      
      // Calculate displayRating and isAbsoluteCinema status
      const igdb = (game.rating && game.rating <= 100) ? game.rating : null;
      const steam = game.steamRating ? game.steamRating * 10 : null;
      const meta = game.metacritic || null;
      const rawg = game.rawgRating ? game.rawgRating * 20 : null;

      const ratings = [igdb, steam, meta, rawg].filter((r): r is number => r !== null);
      const sourcesCount = ratings.length;

      if (sourcesCount > 0) {
        const avg = ratings.reduce((sum, val) => sum + val, 0) / sourcesCount;
        if (sourcesCount >= 2) {
          game.displayRating = Math.round(avg * 10) / 10;
          game.isAbsoluteCinema = avg >= 90;
        } else {
          // 1 source: deflate towards 70
          const weightedScore = (avg + 70) / 2;
          game.displayRating = Math.round(weightedScore * 10) / 10;
          game.isAbsoluteCinema = false; // Require at least 2 sources for Absolute Cinema
        }
      } else {
        game.displayRating = null;
        game.isAbsoluteCinema = false;
      }
    }

    // Calculate nextCursor containing both offset and ID for compatibility and correct pagination
    let nextCursor: string | null = null;
    if (fetchedGames.length >= limit) {
      const nextOffset = offset + fetchedGames.length;
      const lastItem = fetchedGames[fetchedGames.length - 1];
      nextCursor = `${nextOffset}_${lastItem.id}`;
    }

    return new Response(
      JSON.stringify({
        games: enrichedGames,
        totalCount,
        maxPrice,
        correctedQuery,
        nextCursor
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
        }
      }
    );
  } catch (error) {
    console.error("Failed to fetch games from database:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "Failed to fetch games from database" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
