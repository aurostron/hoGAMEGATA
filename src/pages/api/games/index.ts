import type { APIRoute } from 'astro';
import { turso, initTursoForRequest, libsqlClient } from '../../../lib/turso';
import { env as cfWorkerEnv } from "cloudflare:workers";
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
import { rateLimit, getClientIp, tooManyRequests } from '../../../lib/rateLimit';
import { isDlcOrExtra } from '../../../lib/dlcHelper';
import { getCatalogStats } from '../../../lib/catalogMeta';

export const prerender = false;

const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');

// In-Memory API response cache (avoids repeated database round-trips)
const API_RESPONSE_CACHE = new Map<string, { body: string; expiresAt: number }>();
const COUNT_CACHE = new Map<string, { val: number; timestamp: number }>();

let cachedGameTitles: string[] | null = null;
async function getGameTitles(): Promise<string[]> {
  if (cachedGameTitles) return cachedGameTitles;
  try {
    const rows = await turso
      .select({ title: gamesTable.title })
      .from(gamesTable)
      .where(or(
        isNotNull(gamesTable.rating),
        isNotNull(gamesTable.steamRating),
        eq(gamesTable.isTrending, true),
        gt(gamesTable.likesCount, 0),
        isNotNull(gamesTable.popularity)
      ))
      .orderBy(desc(sql`COALESCE(${gamesTable.popularity}, 0) + COALESCE(${gamesTable.rating}, 0) + (CASE WHEN ${gamesTable.isTrending} THEN 100 ELSE 0 END)`))
      .limit(5000);
    cachedGameTitles = rows.map(r => r.title).filter(Boolean);
    return cachedGameTitles;
  } catch (err) {
    console.error("Failed to fetch game titles for spelling correction:", err);
    return [];
  }
}

let cachedMaxPrice: { val: number; timestamp: number } | null = null;
async function getCachedMaxPrice(): Promise<number> {
  if (cachedMaxPrice && Date.now() - cachedMaxPrice.timestamp < 3600000) {
    return cachedMaxPrice.val;
  }
  try {
    const [maxPriceRow] = await turso
      .select({ maxPrice: sql<number>`max(${priceSnapshotsTable.dealPrice})` })
      .from(priceSnapshotsTable);
    const val = maxPriceRow?.maxPrice || 60;
    cachedMaxPrice = { val, timestamp: Date.now() };
    return val;
  } catch (err) {
    return cachedMaxPrice?.val || 60;
  }
}

export const GET: APIRoute = async ({ request, locals }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`games_api:${clientIp}`, 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter, undefined, request);

  // Check In-Memory API Cache
  const cacheKey = request.url;
  const cached = API_RESPONSE_CACHE.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return new Response(cached.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "HIT",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  }

  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfWorkerEnv)
    : (cfWorkerEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || searchParams.get("q")?.trim() || "";

    // Search analytics deleted (2026-09-09): zero Turso writes on the request path.

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

    // 1-3. Resolve Filter IDs Concurrently in Parallel
    const [creatorGameIds, tagGameIds, genreGameIds, platformGameIds] = await Promise.all([
      // 1. Resolve Creator IDs Filter
      (async (): Promise<string[] | null> => {
        if (!creatorIdsParam) return null;
        const creatorIds = creatorIdsParam.split(",").filter(Boolean);
        if (creatorIds.length === 0) return null;
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
        return Array.from(new Set([
          ...devGames.map(dg => dg.gameId),
          ...pubGames.map(pg => pg.gameId)
        ]));
      })(),

      // 2. Resolve Tag/Feature Slugs Filter (AND logic)
      (async (): Promise<string[] | null> => {
        if (allActiveTags.length === 0) return null;
        const matchedTags = await turso
          .select({ id: tagsTable.id })
          .from(tagsTable)
          .where(inArray(tagsTable.slug, allActiveTags));

        const tagIds = matchedTags.map(t => t.id);
        if (tagIds.length === 0) return [];

        const rows = await turso
          .select({ gameId: gamesToTags.gameId, tagId: gamesToTags.tagId })
          .from(gamesToTags)
          .where(inArray(gamesToTags.tagId, tagIds));

        const tagCounts = new Map<string, number>();
        for (const r of rows) {
          tagCounts.set(r.gameId, (tagCounts.get(r.gameId) || 0) + 1);
        }

        return Array.from(tagCounts.entries())
          .filter(([_, count]) => count >= tagIds.length)
          .map(([id]) => id);
      })(),

      // 3. Resolve Genre Slugs Filter (OR logic)
      (async (): Promise<string[] | null> => {
        if (selectedGenres.length === 0) return null;
        const matchedGenres = await turso
          .select({ id: genresTable.id })
          .from(genresTable)
          .where(inArray(genresTable.slug, selectedGenres));
        const genreIds = matchedGenres.map(g => g.id);
        if (genreIds.length === 0) return [];

        const rows = await turso
          .select({ gameId: gamesToGenres.gameId })
          .from(gamesToGenres)
          .where(inArray(gamesToGenres.genreId, genreIds));
        
        return Array.from(new Set(rows.map(r => r.gameId)));
      })(),

      // 3.5. Resolve Platform Filter
      (async (): Promise<string[] | null> => {
        if (selectedSystems.length === 0) return null;
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
            platformConds.push(like(platformsTable.slug, "%linux%"));
          }
        }
        const matchedPlatforms = await turso
          .select({ id: platformsTable.id })
          .from(platformsTable)
          .where(or(...platformConds));
        
        const platformIds = matchedPlatforms.map(p => p.id);
        if (platformIds.length === 0) return [];

        const platformGames = await turso
          .select({ gameId: gamesToPlatforms.gameId })
          .from(gamesToPlatforms)
          .where(inArray(gamesToPlatforms.platformId, platformIds));
        
        return Array.from(new Set(platformGames.map(pg => pg.gameId)));
      })(),
    ]);

    // Check if any active filter produced 0 results
    if (
      (tagGameIds !== null && tagGameIds.length === 0) ||
      (genreGameIds !== null && genreGameIds.length === 0) ||
      (platformGameIds !== null && platformGameIds.length === 0) ||
      (creatorGameIds !== null && creatorGameIds.length === 0)
    ) {
      return new Response(
        JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Intersect Filter IDs
    let filterGameIds: string[] | null = null;
    const activeFilters = [creatorGameIds, tagGameIds, genreGameIds, platformGameIds].filter(f => f !== null) as string[][];
    if (activeFilters.length > 0) {
      filterGameIds = activeFilters.reduce((a, b) => a.filter(id => b.includes(id)));
      if (filterGameIds.length === 0) {
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Search Preprocessing with FTS5 Indexing
    let finalSearch = search;
    let correctedQuery: string | null = null;

    const expandedAbbr = expandAbbreviations(search);
    if (expandedAbbr) {
      finalSearch = expandedAbbr;
    }

    let ftsGameIds: string[] | null = null;
    if (finalSearch.trim()) {
      const cleanTerm = finalSearch.trim().replace(/[^\w\s-]/g, " ").trim();
      if (cleanTerm) {
        const tokens = cleanTerm.split(/\s+/).filter(Boolean);
        const ftsQuery = tokens.map(t => `"${t}"*`).join(" ");
        try {
          const ftsRes = await libsqlClient.execute({
            sql: `SELECT id FROM "Game_fts" WHERE "Game_fts" MATCH ? ORDER BY rank LIMIT 500`,
            args: [ftsQuery]
          });
          ftsGameIds = ftsRes.rows.map((r: any) => r.id as string);
        } catch (ftsErr) {
          console.warn("FTS5 query failed, falling back to standard LIKE search:", ftsErr);
        }
      }
    }

    if (ftsGameIds !== null && ftsGameIds.length === 0) {
      if (finalSearch.length > 3) {
        const allTitles = await getGameTitles();
        const correction = suggestCorrection(finalSearch, allTitles);
        if (correction && correction.toLowerCase() !== finalSearch.toLowerCase()) {
          correctedQuery = correction;
          finalSearch = correction;
          const cleanTerm = finalSearch.trim().replace(/[^\w\s-]/g, " ").trim();
          if (cleanTerm) {
            const tokens = cleanTerm.split(/\s+/).filter(Boolean);
            const ftsQuery = tokens.map(t => `"${t}"*`).join(" ");
            try {
              const ftsRes = await libsqlClient.execute({
                sql: `SELECT id FROM "Game_fts" WHERE "Game_fts" MATCH ? ORDER BY rank LIMIT 500`,
                args: [ftsQuery]
              });
              ftsGameIds = ftsRes.rows.map((r: any) => r.id as string);
            } catch (e) {
              // ignore
            }
          }
        }
      }

      if (ftsGameIds.length === 0) {
        // Fast path: No matching games found even after typo correction
        return new Response(
          JSON.stringify({ games: [], totalCount: 0, correctedQuery, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const buildConditions = (searchTerm: string, activeFilterIds: string[] | null) => {
      const conds = [];
      
      // Filter out hidden games
      conds.push(or(isNull(gamesTable.status), ne(gamesTable.status, "hidden")));
      
      const todayDate = new Date();
      if (sort === "upcoming") {
        conds.push(
          or(
            eq(gamesTable.status, "upcoming"),
            gt(gamesTable.releaseDate, todayDate)
          )
        );
      } else if (sort === "latest") {
        conds.push(
          and(
            or(isNull(gamesTable.status), ne(gamesTable.status, "upcoming")),
            or(
              isNull(gamesTable.releaseDate),
              lte(gamesTable.releaseDate, todayDate)
            )
          )
        );
      } else {
        conds.push(
          and(
            or(isNull(gamesTable.status), ne(gamesTable.status, "upcoming")),
            or(
              isNull(gamesTable.releaseDate),
              lte(gamesTable.releaseDate, todayDate)
            )
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

      // If FTS5 matched IDs, constrain directly by primary key index (zero full table scans!)
      if (ftsGameIds !== null && ftsGameIds.length > 0) {
        conds.push(inArray(gamesTable.id, ftsGameIds));
      } else if (searchTerm) {
        const searchOrConds = [
          like(gamesTable.title, `%${searchTerm}%`),
          like(gamesTable.developerNames, `%${searchTerm}%`),
          like(gamesTable.slug, `%${searchTerm}%`)
        ];
        conds.push(or(...searchOrConds));
      }

      if (hideDlcs) {
        conds.push(or(isNull(gamesTable.category), sql`${gamesTable.category} NOT IN (1, 2, 3, 10, 13)`));
        conds.push(sql`${gamesTable.title} NOT LIKE '% Pack'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Pack)%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Bundle'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Bundle)%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Upgrade'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% DLC'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% DLC)%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% DLC %'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Soundtrack%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Season Pass%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Expansion Pass%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Expansion Pack%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Bonus Content%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE '% Artbook%'`);
        conds.push(sql`${gamesTable.title} NOT LIKE 'The Outlast Trials: Project %'`);
        conds.push(sql`${gamesTable.title} NOT LIKE 'Outlast: Whistleblower%'`);
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

    // Get Total Matching Count (Optimized: 0 Turso row scans for standard browsing and indexed search)
    let totalCount = 0;
    const catalogStats = getCatalogStats();

    if (ftsGameIds !== null) {
      // FTS search count is directly derived from matching IDs without scanning Game table
      totalCount = ftsGameIds.length;
    } else if (filterGameIds !== null && filterGameIds.length > 0) {
      // Filter intersection count is known from the joined IDs
      totalCount = filterGameIds.length;
    } else if (!finalSearch && !minPriceParam && !maxPriceParam && !freeOnly && selectedDecades.length === 0) {
      // Standard catalog browsing: use pre-computed count directly (0 reads)
      totalCount = hideDlcs ? catalogStats.totalVisibleGames : catalogStats.totalGames;
    } else {
      // Custom filter combination: use in-memory LRU cache with 15m TTL to prevent repeated scans
      const countKey = `${conditions.length}_${finalSearch}_${minPriceParam}_${maxPriceParam}_${freeOnly}_${selectedDecades.join(",")}_${hideDlcs}`;
      const cached = COUNT_CACHE.get(countKey);
      if (cached && Date.now() - cached.timestamp < 900000) {
        totalCount = cached.val;
      } else {
        let countQuery = turso.select({ count: count() }).from(gamesTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions)) as any;
        }
        const [{ count: countVal }] = await countQuery;
        totalCount = countVal;
        if (COUNT_CACHE.size > 200) {
          const firstKey = COUNT_CACHE.keys().next().value;
          if (firstKey) COUNT_CACHE.delete(firstKey);
        }
        COUNT_CACHE.set(countKey, { val: totalCount, timestamp: Date.now() });
      }
    }

    // Query Max Price in DB (cached with 1-hour TTL)
    const maxPrice = await getCachedMaxPrice();

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
        sql`COALESCE(${gamesTable.popularity}, 0) DESC`,
        sql`COALESCE(${gamesTable.rating}, 0) DESC`,
        desc(gamesTable.likesCount),
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "top-rated") {
      baseQuery = baseQuery.orderBy(
        sql`CASE WHEN ${gamesTable.rating} IS NULL THEN 1 ELSE 0 END`,
        desc(gamesTable.rating),
        sql`COALESCE(${gamesTable.steamRating}, 0) DESC`,
        desc(gamesTable.id)
      ) as any;
    } else if (sort === "upcoming") {
      baseQuery = baseQuery.orderBy(
        sql`CASE WHEN ${gamesTable.releaseDate} IS NULL THEN 1 ELSE 0 END`,
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
        sql`CASE WHEN ${gamesTable.releaseDate} IS NULL THEN 1 ELSE 0 END`,
        desc(gamesTable.releaseDate),
        desc(gamesTable.id)
      ) as any;
    } else {
      // default: trending
      baseQuery = baseQuery.orderBy(
        desc(gamesTable.isTrending),
        sql`COALESCE(${gamesTable.popularity}, 0) DESC`,
        sql`COALESCE(${gamesTable.rating}, 0) DESC`,
        desc(gamesTable.likesCount),
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

    // Parallelize relation enrichment (tags, purchase links) and price snapshots
    const gameIds = fetchedGames.map((g: any) => g.id);
    const [enrichedGames, snapshots] = await Promise.all([
      enrichGamesWithRelations(fetchedGames),
      gameIds.length > 0
        ? turso
            .select()
            .from(priceSnapshotsTable)
            .where(inArray(priceSnapshotsTable.gameId, gameIds))
        : Promise.resolve([]),
    ]);

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

    const finalGames = hideDlcs
      ? enrichedGames.filter((game: any) => !isDlcOrExtra(game.title, game.category))
      : enrichedGames;

    const responsePayload = JSON.stringify({
      games: finalGames,
      totalCount,
      maxPrice,
      correctedQuery,
      nextCursor
    });

    // Cache response in memory: 60s for searches, 300s for catalog browsing
    const cacheTtlMs = search ? 60 * 1000 : 300 * 1000;
    if (API_RESPONSE_CACHE.size > 200) {
      const firstKey = API_RESPONSE_CACHE.keys().next().value;
      if (firstKey) API_RESPONSE_CACHE.delete(firstKey);
    }
    API_RESPONSE_CACHE.set(cacheKey, {
      body: responsePayload,
      expiresAt: Date.now() + cacheTtlMs,
    });

    return new Response(
      responsePayload,
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "MISS",
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
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
