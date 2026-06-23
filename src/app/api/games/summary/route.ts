import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

interface CacheEntry {
  data: any;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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
    const sort = searchParams.get("sort")?.trim() || "latest";
    const _creatorIdsParam = searchParams.get("creatorIds")?.trim() || "";
    const excludeId = searchParams.get("excludeId")?.trim() || "";
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "5000", 10) || 5000, 1), 5000);

    const supabase = getSupabaseServer();

    const gameSummarySelect = "id, title, slug, coverUrl, releaseDate, rating, genreNames, platformNames, priceSnapshots:PriceSnapshot(*), tags:Tag(name, slug)";

    let query = supabase.from("Game").select(gameSummarySelect);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    // Tag filtering
    if (selectedTags.length > 0) {
      // Fetch games with ANY of the tags
      const { data: tagGames } = await supabase
        .from("_GameToTag")
        .select("A, B:Tag!inner(slug)")
        .in("B.slug", selectedTags);

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
        .filter((entry) => entry[1].size >= selectedTags.length)
        .map((entry) => entry[0]);

      if (validGameIds.length === 0) {
        return NextResponse.json(
          { games: [], nextCursor: null, totalCount: 0 },
          { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
        );
      }

      query = query.in("id", validGameIds);
    }

    // Sorting
    if (sort === "trending") {
      query = query.order("isTrending", { ascending: false });
      query = query.order("popularity", { ascending: false, nullsFirst: false });
      query = query.order("id", { ascending: false });
    } else if (sort === "top-rated") {
      query = query.order("rating", { ascending: false, nullsFirst: false });
      query = query.order("id", { ascending: false });
    } else {
      query = query.order("releaseDate", { ascending: false });
    }

    // Cursor pagination (using Supabase cursor-based approach)
    if (cursor) {
      const { data: cursorGame } = await supabase
        .from("Game")
        .select("id")
        .eq("id", cursor)
        .limit(1)
        .maybeSingle();

      if (cursorGame) {
        // Simple cursor: fetch games after this cursor
        if (sort === "latest") {
          query = query.gt("releaseDate", cursor);
        } else if (sort === "top-rated") {
          query = query.gt("rating", 0);
        }
      }
    }

    // Count total
    const { count: totalCount } = await supabase
      .from("Game")
      .select("*", { count: "exact", head: true });

    // Fetch games
    query = query.limit(limit + 1);
    const { data: fetchedGames } = await query;

    const allGames = fetchedGames || [];
    let nextCursor: string | null = null;
    let games = allGames.slice(0, limit);

    if (allGames.length > limit) {
      nextCursor = games[games.length - 1]?.id || null;
    }

    const responseData = {
      games,
      nextCursor,
      totalCount: totalCount || 0,
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
