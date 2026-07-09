import type { APIRoute } from "astro";
import { turso } from "../../../lib/turso";
import { analyticsEvents, analyticsDaily } from "../../../db/schema";
import { eq, desc, and, gte, sum } from "drizzle-orm";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";
    
    const rangeDays = range === "30d" ? 30 : 7;
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - rangeDays);
    const startDateString = startDate.toISOString().split("T")[0];

    // Fetch daily series, aggregate totals, and top metrics in parallel
    const [
      dailySeries,
      [totalsResult],
      topGames,
      topSearches,
      topLinks
    ] = await Promise.all([
      // 1. Daily time series (views, clicks, searches)
      turso
        .select()
        .from(analyticsDaily)
        .where(gte(analyticsDaily.date, startDateString))
        .orderBy(analyticsDaily.date),

      // 2. Summary aggregates
      turso
        .select({
          views: sum(analyticsDaily.totalViews),
          clicks: sum(analyticsDaily.totalClicks),
          searches: sum(analyticsDaily.totalSearches),
        })
        .from(analyticsDaily)
        .where(gte(analyticsDaily.date, startDateString)),

      // 3. Top 10 viewed games
      turso
        .select({
          gameId: analyticsEvents.refId,
          title: analyticsEvents.refTitle,
          views: sum(analyticsEvents.count),
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.type, "game_view"),
            gte(analyticsEvents.date, startDateString)
          )
        )
        .groupBy(analyticsEvents.refId, analyticsEvents.refTitle)
        .orderBy(desc(sum(analyticsEvents.count)))
        .limit(10),

      // 4. Top 10 search queries
      turso
        .select({
          query: analyticsEvents.refTitle,
          count: sum(analyticsEvents.count),
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.type, "search"),
            gte(analyticsEvents.date, startDateString)
          )
        )
        .groupBy(analyticsEvents.refId, analyticsEvents.refTitle)
        .orderBy(desc(sum(analyticsEvents.count)))
        .limit(10),

      // 5. Top 10 link clicks
      turso
        .select({
          linkId: analyticsEvents.refId,
          title: analyticsEvents.refTitle,
          count: sum(analyticsEvents.count),
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.type, "link_click"),
            gte(analyticsEvents.date, startDateString)
          )
        )
        .groupBy(analyticsEvents.refId, analyticsEvents.refTitle)
        .orderBy(desc(sum(analyticsEvents.count)))
        .limit(10),
    ]);

    const formattedTotals = {
      views: Number(totalsResult?.views || 0),
      clicks: Number(totalsResult?.clicks || 0),
      searches: Number(totalsResult?.searches || 0),
    };

    return new Response(
      JSON.stringify({
        totals: formattedTotals,
        dailySeries,
        topGames,
        topSearches,
        topLinks,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("[Analytics API] Failed to fetch analytics:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch analytics data" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
