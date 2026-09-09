import type { APIRoute } from "astro";
import { turso, initTursoForRequest } from "../../../lib/turso";
import { purchaseLinks as purchaseLinksTable, priceSnapshots as priceSnapshotsTable } from "../../../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { env as cfEnv } from "cloudflare:workers";
import { rateLimit, getClientIp, tooManyRequests } from "../../../lib/rateLimit";
import { fetchItchDataJson, formatItchBadge } from "../../../lib/itchParser";

export const prerender = false;

interface PriceResult {
  priceBadge: string;
  badgeType: "free" | "sale" | "paid";
  coverUrl?: string | null;
}

export const GET: APIRoute = async ({ request }) => {
  const clientIp = getClientIp(request);
  const rl = await rateLimit(`prices_quick:${clientIp}`, 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter, undefined, request);

  const { searchParams } = new URL(request.url);
  const rawIds = searchParams.get("ids")?.trim() || "";
  if (!rawIds) {
    return new Response(JSON.stringify({ prices: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const idList = Array.from(
    new Set(
      rawIds
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  ).slice(0, 10); // Cap at max 10 IDs per invocation

  if (idList.length === 0) {
    return new Response(JSON.stringify({ prices: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Cloudflare Edge Cache check (0ms CPU, 0 subrequests, 0 DB reads)
  const cache = typeof caches !== "undefined" && (caches as any).default ? (caches as any).default : null;
  let cacheKey: Request | null = null;
  if (cache) {
    try {
      const url = new URL(request.url);
      cacheKey = new Request(`${url.origin}${url.pathname}?ids=${idList.sort().join(",")}`, {
        method: "GET",
      });
      const cachedRes = await cache.match(cacheKey);
      if (cachedRes) {
        const hitRes = new Response(cachedRes.body, cachedRes);
        hitRes.headers.set("X-Gamegata-Cache", "HIT");
        return hitRes;
      }
    } catch {
      // Ignore cache match error
    }
  }

  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const runtimeEnv = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (typeof process !== "undefined" ? process.env : {}));

  initTursoForRequest(runtimeEnv);

  const results: Record<string, PriceResult> = {};

  try {
    // 2. Single batched Turso read for price snapshots
    const snapshots = await turso
      .select()
      .from(priceSnapshotsTable)
      .where(
        and(
          inArray(priceSnapshotsTable.gameId, idList),
          eq(priceSnapshotsTable.country, "US")
        )
      )
      .orderBy(priceSnapshotsTable.dealPrice);

    for (const snap of snapshots) {
      if (!results[snap.gameId]) {
        let priceBadge = `$${snap.dealPrice.toFixed(2)}`;
        let badgeType: "free" | "sale" | "paid" = "paid";

        if (snap.dealPrice === 0 && snap.retailPrice > 0) {
          priceBadge = "100% OFF (FREE)";
          badgeType = "free";
        } else if (snap.dealPrice === 0) {
          priceBadge = "FREE";
          badgeType = "free";
        } else if (snap.discountPercent > 0) {
          priceBadge = `$${snap.dealPrice.toFixed(2)} (-${snap.discountPercent}%)`;
          badgeType = "sale";
        }

        results[snap.gameId] = { priceBadge, badgeType };
      }
    }

    // 3. For games without a snapshot, check if any have an itch.io link
    const missingIds = idList.filter((id) => !results[id]);
    if (missingIds.length > 0) {
      const links = await turso
        .select({
          gameId: purchaseLinksTable.gameId,
          url: purchaseLinksTable.url,
          storeName: purchaseLinksTable.storeName,
        })
        .from(purchaseLinksTable)
        .where(inArray(purchaseLinksTable.gameId, missingIds));

      const itchLinks = links.filter(
        (l) => l.storeName?.toLowerCase().includes("itch") || (l.url && l.url.includes("itch.io"))
      );

      // Concurrency guard: Process maximum 2 simultaneous itch fetches to stay far below Cloudflare's 6 connection limit
      const CONCURRENCY_LIMIT = 2;
      for (let i = 0; i < itchLinks.length; i += CONCURRENCY_LIMIT) {
        const batch = itchLinks.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(
          batch.map(async (link) => {
            try {
              const itchData = await fetchItchDataJson(link.url, 1500);
              if (itchData.success) {
                // Display-only (2026-09-09): live data.json served in-response.
                // Never persist from the request path — the weekly batch owns all writes.
                const badge = formatItchBadge(itchData);
                results[link.gameId] = {
                  priceBadge: badge.badgeText,
                  badgeType: badge.badgeType,
                  coverUrl: itchData.coverUrl || null,
                };
              }
            } catch {
              // Ignore timeout
            }
          })
        );
      }
    }

    const response = new Response(JSON.stringify({ prices: results }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        "X-Gamegata-Cache": "MISS",
      },
    });

    if (cache && cacheKey) {
      cache.put(cacheKey, response.clone()).catch(() => {});
    }

    return response;
  } catch (error) {
    console.error("[Quick Prices Error]:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ prices: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
