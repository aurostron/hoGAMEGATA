import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import { games as gamesTable, gameRecommendations as gameRecommendationsTable, aiSearchCache as aiSearchCacheTable } from '../../../db/schema';
import { or, isNull, ne, eq, like, and, inArray } from 'drizzle-orm';
import {
  normalizeQueryForCache,
  validateDSL,
  executeDSLQuery,
  preprocessSearchQuery
} from '../../../lib/searchEngine';
import { enrichGamesWithRelations } from '../../../lib/gameQueries';

export const prerender = false;

const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');

// Dynamic Node imports to avoid Cloudflare bundle errors at runtime
let cfEnv: any = null;
let nodeFs: any = null;
let nodePath: any = null;

try {
  if (isDev) {
    nodeFs = await import("node:fs");
    nodePath = await import("node:path");
  } else {
    const { env } = await import("cloudflare:workers");
    cfEnv = env;
  }
} catch (e) {
  // Ignored in local dev or non-worker environments
}

// Local file cache helpers for development mode
const getLocalCachePath = () => {
  if (!nodePath) return "";
  return nodePath.join(process.cwd(), '.astro', 'local_search_cache.json');
};

const readLocalCache = (): Record<string, string> => {
  if (!nodeFs) return {};
  try {
    const cachePath = getLocalCachePath();
    if (nodeFs.existsSync(cachePath)) {
      return JSON.parse(nodeFs.readFileSync(cachePath, 'utf8'));
    }
  } catch (e) {}
  return {};
};

const writeLocalCache = (cache: Record<string, string>) => {
  if (!nodeFs) return;
  try {
    const cachePath = getLocalCachePath();
    const dir = nodePath.dirname(cachePath);
    if (!nodeFs.existsSync(dir)) nodeFs.mkdirSync(dir, { recursive: true });
    nodeFs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {}
};

function getKVCache(): any {
  const env = isDev
    ? (typeof process !== 'undefined' && process.env ? process.env : cfEnv)
    : cfEnv;
  
  const cloudflareKV = (env as any)?.AI_SEARCH_CACHE;
  if (cloudflareKV) return cloudflareKV;

  // Local development file cache fallback
  if (isDev) {
    return {
      get: async (key: string) => {
        const cache = readLocalCache();
        return cache[key] || null;
      },
      put: async (key: string, value: string) => {
        const cache = readLocalCache();
        cache[key] = value;
        writeLocalCache(cache);
      }
    };
  }

  return undefined;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { query, dsl } = body;

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid query parameter" }), { status: 400 });
    }

    const kv = getKVCache();
    const CACHE_VERSION = "v3"; // Bumped version to clear old layouts
    const normalized = normalizeQueryForCache(query);
    const cacheKey = `ai-cache:${CACHE_VERSION}:${normalized}`;
    const directCacheKey = `direct-cache:${CACHE_VERSION}:${normalized}`;

    // --- STAGE 1: Cache Check & Direct Title Match ---
    if (!dsl) {
      // 0. Check Drizzle database cache first (globally replicated edge cache, $0 cost, 0ms LLM latency)
      const { cleanedQuery } = preprocessSearchQuery(query);
      const cleanedLower = cleanedQuery?.toLowerCase().trim();
      
      if (cleanedLower) {
        try {
          const [dbCached] = await turso
            .select({ resultsJson: aiSearchCacheTable.resultsJson })
            .from(aiSearchCacheTable)
            .where(eq(aiSearchCacheTable.query, cleanedLower))
            .limit(1);

          if (dbCached && dbCached.resultsJson) {
            const parsedResults = JSON.parse(dbCached.resultsJson);
            return new Response(
              JSON.stringify({ status: "success", results: parsedResults }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
        } catch (dbCacheErr) {
          console.error("⚠️ DB search cache read failed:", dbCacheErr);
        }
      }

      if (kv && normalized) {
        try {
          // 1. Check direct matches cache first (saves 100% of direct lookup reads)
          const cachedDirect = await kv.get(directCacheKey);
          if (cachedDirect) {
            const parsed = JSON.parse(cachedDirect);
            return new Response(
              JSON.stringify({ status: "direct_match", results: parsed.results }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 2. Check standard search cache
          const cached = await kv.get(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            return new Response(
              JSON.stringify({ status: "success", results: parsed.results }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
        } catch (e) {
          console.error("KV search cache read failed:", e);
        }
      }

      // 3. Fallback: Check for direct title match in DB using cleaned query (saves fetching 18,000+ titles)
      // We clean the query of conversational fillers first to check for game titles like "games like visage" -> "visage"
      let matchedGame: any = null;

      if (cleanedQuery && cleanedQuery.length >= 2) {
        const [exact] = await turso
          .select()
          .from(gamesTable)
          .where(and(
            like(gamesTable.title, cleanedQuery),
            or(isNull(gamesTable.status), ne(gamesTable.status, "hidden"))
          ))
          .limit(1);

        if (exact) {
          matchedGame = exact;
        } else {
          const [approx] = await turso
            .select()
            .from(gamesTable)
            .where(and(
              like(gamesTable.title, `%${cleanedQuery}%`),
              or(isNull(gamesTable.status), ne(gamesTable.status, "hidden"))
            ))
            .limit(1);
          if (approx) matchedGame = approx;
        }
      }

      if (matchedGame) {
        // Fetch precalculated recommendations from DB for instant, 100% accurate results
        const recs = await turso
          .select({
            recommendedGameId: gameRecommendationsTable.recommendedGameId,
          })
          .from(gameRecommendationsTable)
          .where(eq(gameRecommendationsTable.gameId, matchedGame.id))
          .orderBy(gameRecommendationsTable.distance)
          .limit(4);

        let finalGames = [matchedGame];

        if (recs.length > 0) {
          const recIds = recs.map(r => r.recommendedGameId);
          const recGames = await turso
            .select()
            .from(gamesTable)
            .where(and(
              inArray(gamesTable.id, recIds),
              or(isNull(gamesTable.status), ne(gamesTable.status, "hidden"))
            ));

          // Sort recGames in the exact order of the precalculated recommendation distance
          const idToIndex = new Map(recIds.map((id, idx) => [id, idx]));
          recGames.sort((a, b) => (idToIndex.get(a.id) ?? 99) - (idToIndex.get(b.id) ?? 99));

          finalGames = [matchedGame, ...recGames];
        }

        const enriched = await enrichGamesWithRelations(finalGames);
        
        // Cache direct title match in KV for 30 days
        if (kv && normalized) {
          try {
            await kv.put(directCacheKey, JSON.stringify({ results: enriched }));
          } catch (e) {
            console.error("KV direct cache write failed:", e);
          }
        }
        return new Response(
          JSON.stringify({ status: "direct_match", results: enriched }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 4. Cache miss: signal that client translation is required
      return new Response(
        JSON.stringify({ status: "needs_translation", normalizedQuery: normalized }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- STAGE 2: Validate client-generated DSL & Execute search ---
    if (!validateDSL(dsl)) {
      return new Response(JSON.stringify({ error: "Invalid DSL query format" }), { status: 400 });
    }

    // Execute query
    const results = await executeDSLQuery(dsl);

    // Save search results to KV cache for 30 days
    if (kv && normalized) {
      try {
        const payload = {
          dsl,
          results,
          cachedAt: new Date().toISOString()
        };
        await kv.put(cacheKey, JSON.stringify(payload));
      } catch (e) {
        console.error("KV search cache write failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ status: "success", results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ AI Search handler error:", error);
    return new Response(JSON.stringify({ error: "Search failed due to internal error" }), { status: 500 });
  }
};
