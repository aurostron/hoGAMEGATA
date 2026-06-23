import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { searchGamesExact, searchGamesSemantic, randomGameIds, getCheapestSnapshots } from '../../../lib/dbRpc';
import { preprocessSearchQuery } from '../../../lib/searchEngine';

export const prerender = false;

const gameSummarySelect = "id, title, slug, status, coverUrl, isTrending, rating, category, esrbRating, pegiRating, developerNames, genreNames, platformNames, releaseDate, tags:Tag(name, slug)";

export const GET: APIRoute = async ({ request }) => {
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

    const supabase = getSupabaseServer();

    let matchedIds: string[] = [];
    let semanticExtractedSlugs: string[] = [];

    if (search) {
      if (mode === "semantic") {
        const { cleanedQuery, expandedQuery, extractedSlugs } = preprocessSearchQuery(search);
        semanticExtractedSlugs = extractedSlugs;
        const results = await searchGamesSemantic(cleanedQuery, expandedQuery, 100);
        matchedIds = results.map(r => r.id);
      } else {
        const results = await searchGamesExact(search, 100);
        matchedIds = results.map(r => r.id);
      }
    } else if (sort === "random") {
      const results = await randomGameIds(
        selectedTags.length > 0 ? selectedTags : null,
        limit
      );
      matchedIds = results.map(r => r.id);
    }

    // Build query
    let query = supabase.from("Game").select(gameSummarySelect);

    // Filter by matched IDs (search or random)
    if (matchedIds.length > 0) {
      query = query.in("id", matchedIds);
    }

    // Exclude specific game
    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    // Filter by creator IDs
    if (creatorIdsParam) {
      const creatorIds = creatorIdsParam.split(",").filter(Boolean);
      if (creatorIds.length > 0) {
        const { data: creatorGames } = await supabase
          .from("_GameToDeveloper")
          .select("A")
          .in("B", creatorIds);
        
        const { data: publisherGames } = await supabase
          .from("_GameToPublisher")
          .select("A")
          .in("B", creatorIds);

        const gameIds = [
          ...(creatorGames || []).map((r: any) => r.A),
          ...(publisherGames || []).map((r: any) => r.A),
        ];

        if (gameIds.length > 0) {
          query = query.in("id", gameIds);
        } else {
          return new Response(
            JSON.stringify({ games: [], nextCursor: null }),
            { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
          );
        }
      }
    }

    // Filter by tag slugs (AND logic)
    const combinedTags = [...selectedTags, ...semanticExtractedSlugs];
    if (combinedTags.length > 0) {
      const { data: tagGames } = await supabase
        .from("_GameToTag")
        .select("A, B:Tag!inner(slug)")
        .in("B.slug", combinedTags);

      const tagCounts = new Map<string, Set<string>>();
      for (const row of tagGames || []) {
        const gameId = row.A;
        const tagSlug = (row.B as any)?.slug;
        if (tagSlug) {
          if (!tagCounts.has(gameId)) tagCounts.set(gameId, new Set());
          tagCounts.get(gameId)!.add(tagSlug);
        }
      }

      const validGameIds = Array.from(tagCounts.entries())
        .filter((entry) => entry[1].size >= combinedTags.length)
        .map((entry) => entry[0]);

      if (validGameIds.length === 0) {
        return new Response(
          JSON.stringify({ games: [], nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
        );
      }

      query = query.in("id", validGameIds);
    }

    let games: any[] = [];
    let nextCursor: string | null = null;

    if (search) {
      const { data: allSearchGames } = await query;
      games = allSearchGames || [];

      if (matchedIds.length > 0) {
        games.sort((a: any, b: any) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
      }

      if (cursor) {
        const cursorIndex = games.findIndex((g: any) => g.id === cursor);
        if (cursorIndex !== -1) {
          games = games.slice(cursorIndex + 1);
        }
      }

      const paginatedGames = games.slice(0, limit);
      if (games.length > limit) {
        nextCursor = paginatedGames[paginatedGames.length - 1]?.id || null;
      }
      games = paginatedGames;
    } else if (sort === "random") {
      const { data: fetchedGames } = await query.limit(limit);
      games = fetchedGames || [];
      if (matchedIds.length > 0) {
        games.sort((a: any, b: any) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
      }
      nextCursor = "more-random";
    } else {
      if (sort === "trending") {
        query = query.order("isTrending", { ascending: false });
        query = query.order("popularity", { ascending: false, nullsFirst: false });
        query = query.order("id", { ascending: false });
      } else if (sort === "top-rated") {
        query = query.order("rating", { ascending: false, nullsFirst: false });
        query = query.order("id", { ascending: false });
      } else {
        query = query.order("releaseDate", { ascending: false, nullsFirst: false });
        query = query.order("id", { ascending: false });
      }

      if (cursor && sort !== "trending") {
        const sep = cursor.lastIndexOf("_");
        const cursorVal = cursor.substring(0, sep);
        const cursorId = cursor.substring(sep + 1);

        if (sort === "top-rated") {
          if (cursorVal === "null") {
            query = query.or(`rating.is.null,and(rating.eq.0,id.lt.${cursorId})`);
          } else {
            query = query.or(`and(rating.lt.${cursorVal}),and(rating.eq.${cursorVal},id.lt.${cursorId})`);
          }
        } else {
          const cursorDate = new Date(parseInt(cursorVal, 10)).toISOString();
          if (cursorVal === "null") {
            query = query.or(`releaseDate.is.null,id.lt.${cursorId}`);
          } else {
            query = query.or(`and(releaseDate.lt.${cursorDate}),and(releaseDate.eq.${cursorDate},id.lt.${cursorId})`);
          }
        }
      }

      if (cursor && sort === "trending") {
        query = query.lt("id", cursor);
      }

      query = query.limit(limit + 1);

      const { data: fetchedGames } = await query;
      const allGames = fetchedGames || [];

      if (allGames.length > limit) {
        const nextItem = allGames.pop()!;
        if (sort === "trending") {
          nextCursor = nextItem.id;
        } else if (sort === "top-rated") {
          nextCursor = `${nextItem.rating ?? "null"}_${nextItem.id}`;
        } else {
          nextCursor = `${nextItem.releaseDate ? new Date(nextItem.releaseDate).getTime() : "null"}_${nextItem.id}`;
        }
      }
      games = allGames;
    }

    // Fetch price snapshots
    const gameIds = games.map((g: any) => g.id);
    const snapshotMap = await getCheapestSnapshots(gameIds);
    const snapshotGrouped = new Map<string, any[]>();
    for (const row of snapshotMap) {
      const { gameId, ...snapshot } = row;
      if (!snapshotGrouped.has(gameId)) snapshotGrouped.set(gameId, []);
      snapshotGrouped.get(gameId)!.push(snapshot);
    }
    for (const game of games) {
      game.priceSnapshots = snapshotGrouped.get(game.id) || [];
    }

    return new Response(
      JSON.stringify({ games, nextCursor }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Failed to fetch games from database:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "Failed to fetch games from database" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
