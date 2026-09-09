import type { APIRoute } from "astro";
import { turso, initTursoForRequest } from "../../../lib/turso";
import { games as gamesTable, purchaseLinks as purchaseLinksTable, priceSnapshots as priceSnapshotsTable } from "../../../db/schema";
import { and, or, ne, eq, inArray, like, sql, desc } from "drizzle-orm";
import { env as cfEnv } from "cloudflare:workers";
import { rateLimit, getClientIp, tooManyRequests } from "../../../lib/rateLimit";
import { fetchItchDataJson, formatItchBadge } from "../../../lib/itchParser";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`search_suggest:${clientIp}`, 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter, undefined, request);

  try {
    const { searchParams } = new URL(request.url);
    const rawQ = searchParams.get("q")?.trim() || searchParams.get("search")?.trim() || "";

    if (!rawQ || rawQ.length === 0) {
      return new Response(
        JSON.stringify({ games: [] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          },
        }
      );
    }

    const cleanQuery = rawQ.toLowerCase().replace(/['"]/g, "");

    // 1. Check Cloudflare Worker Edge Cache for instant (3-5ms) response
    const cache = typeof caches !== "undefined" && (caches as any).default ? (caches as any).default : null;
    let cacheKey: Request | null = null;
    if (cache) {
      try {
        const url = new URL(request.url);
        cacheKey = new Request(`${url.origin}${url.pathname}?q=${encodeURIComponent(cleanQuery)}`, {
          method: "GET"
        });
        const cachedRes = await cache.match(cacheKey);
        if (cachedRes) {
          const hitRes = new Response(cachedRes.body, cachedRes);
          hitRes.headers.set("X-Gamegata-Cache", "HIT");
          return hitRes;
        }
      } catch {
        // Cache match fallback
      }
    }

    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
    const runtimeEnv = isDev
      ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
      : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

    initTursoForRequest(runtimeEnv);

    const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
    const prefixQuery = `${cleanQuery}%`;
    const substringQuery = `%${cleanQuery}%`;

    // Build conditions: match full substring or individual tokens
    const conditions = [
      like(gamesTable.title, substringQuery),
      like(gamesTable.developerNames, substringQuery),
    ];

    for (const term of terms) {
      if (term.length >= 2) {
        conditions.push(like(gamesTable.title, `%${term}%`));
        conditions.push(like(gamesTable.developerNames, `%${term}%`));
      }
    }

    const firstTerm = terms[0] || cleanQuery;
    const firstTermPrefix = `${firstTerm}%`;

    const rows = await turso
      .select({
        id: gamesTable.id,
        title: gamesTable.title,
        slug: gamesTable.slug,
        coverUrl: gamesTable.coverUrl,
        developerNames: gamesTable.developerNames,
        isTrending: gamesTable.isTrending,
        rating: gamesTable.rating,
        popularity: gamesTable.popularity,
      })
      .from(gamesTable)
      .where(
        and(
          ne(gamesTable.status, "hidden"),
          or(...conditions)
        )
      )
      .orderBy(
        sql`CASE 
          WHEN LOWER(${gamesTable.title}) = ${cleanQuery} THEN 1000
          WHEN LOWER(${gamesTable.title}) LIKE ${prefixQuery} THEN 500
          WHEN LOWER(${gamesTable.title}) LIKE ${substringQuery} THEN 300
          WHEN LOWER(${gamesTable.title}) LIKE ${firstTermPrefix} THEN 200
          WHEN LOWER(${gamesTable.developerNames}) LIKE ${substringQuery} THEN 150
          ELSE 50
        END DESC`,
        desc(gamesTable.isTrending),
        desc(gamesTable.rating),
        desc(gamesTable.popularity)
      )
      .limit(10);

    if (rows.length === 0) {
      const emptyRes = new Response(
        JSON.stringify({ games: [] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
            "X-Gamegata-Cache": "MISS"
          },
        }
      );
      if (cache && cacheKey) {
        cache.put(cacheKey, emptyRes.clone()).catch(() => {});
      }
      return emptyRes;
    }

    const gameIds = rows.map(r => r.id);

    // 2. Batch fetch all price snapshots in ONE single query for all matched games (eliminates N+1 queries)
    const snapshotsMap = new Map<string, typeof priceSnapshotsTable.$inferSelect>();
    try {
      const allSnapshots = await turso
        .select()
        .from(priceSnapshotsTable)
        .where(
          and(
            inArray(priceSnapshotsTable.gameId, gameIds),
            eq(priceSnapshotsTable.country, "US")
          )
        )
        .orderBy(priceSnapshotsTable.dealPrice);

      for (const snap of allSnapshots) {
        if (!snapshotsMap.has(snap.gameId)) {
          snapshotsMap.set(snap.gameId, snap);
        }
      }
    } catch (snapErr) {
      console.warn("[Suggest] Failed to batch fetch price snapshots:", snapErr);
    }

    // 3. Batch fetch purchase links in ONE single query only for games that need cover or price
    const gamesNeedingLinks = rows.filter(g => !g.coverUrl || !snapshotsMap.has(g.id)).map(g => g.id);
    const linksByGame = new Map<string, { url: string; storeName: string }[]>();

    if (gamesNeedingLinks.length > 0) {
      try {
        const allLinks = await turso
          .select({
            gameId: purchaseLinksTable.gameId,
            url: purchaseLinksTable.url,
            storeName: purchaseLinksTable.storeName
          })
          .from(purchaseLinksTable)
          .where(inArray(purchaseLinksTable.gameId, gamesNeedingLinks));

        for (const link of allLinks) {
          const list = linksByGame.get(link.gameId) || [];
          list.push(link);
          linksByGame.set(link.gameId, list);
        }
      } catch (linkErr) {
        console.warn("[Suggest] Failed to batch fetch purchase links:", linkErr);
      }
    }

    // 4. Enrich games with batch data & fast fallback
    const enrichedGames = await Promise.all(
      rows.map(async (game) => {
        let priceBadge: string | null = null;
        let badgeType: "free" | "sale" | "paid" = "paid";
        let activeCoverUrl = game.coverUrl;

        const bestDeal = snapshotsMap.get(game.id);
        if (bestDeal) {
          if (bestDeal.dealPrice === 0 && bestDeal.retailPrice > 0) {
            priceBadge = "100% OFF (FREE)";
            badgeType = "free";
          } else if (bestDeal.dealPrice === 0) {
            priceBadge = "FREE";
            badgeType = "free";
          } else if (bestDeal.discountPercent > 0) {
            priceBadge = `$${bestDeal.dealPrice.toFixed(2)} (-${bestDeal.discountPercent}%)`;
            badgeType = "sale";
          } else {
            priceBadge = `$${bestDeal.dealPrice.toFixed(2)}`;
            badgeType = "paid";
          }
        }

        // If cover is missing or if no price badge found, check if it has an itch.io link
        if (!activeCoverUrl || !priceBadge) {
          const links = linksByGame.get(game.id) || [];
          const itchLink = links.find(
            l => l.storeName?.toLowerCase().includes("itch") || (l.url && l.url.includes("itch.io"))
          );

          if (itchLink) {
            try {
              const itchData = await fetchItchDataJson(itchLink.url, 1500);
              if (itchData.success) {
                // Display-only (2026-09-09): live data.json enriches THIS response.
                // Never persist from the request path — the weekly batch owns all writes.
                if (!activeCoverUrl && itchData.coverUrl) {
                  activeCoverUrl = itchData.coverUrl;
                }

                if (!priceBadge) {
                  const badge = formatItchBadge(itchData);
                  priceBadge = badge.badgeText;
                  badgeType = badge.badgeType;
                }
              }
            } catch {
              // Ignore timeout
            }
          }
        }

        return {
          ...game,
          coverUrl: activeCoverUrl,
          priceBadge,
          badgeType,
        };
      })
    );

    const response = new Response(
      JSON.stringify({ games: enrichedGames }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          "X-Gamegata-Cache": "MISS"
        },
      }
    );

    if (cache && cacheKey) {
      cache.put(cacheKey, response.clone()).catch(() => {});
    }

    return response;
  } catch (error) {
    console.error("Search suggest API error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ games: [], error: "Failed to fetch suggestions" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
