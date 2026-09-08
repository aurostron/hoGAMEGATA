import type { APIRoute } from 'astro';
import { tursoAuth } from '../../lib/tursoAuth';
import { waitlist } from '../../db/auth-schema';
import { count } from 'drizzle-orm';
import { getCatalogStats } from '../../lib/catalogMeta';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const catalogStats = getCatalogStats();

    // Only query the tiny waitlist table (<100 rows)
    let totalWaitlist = 0;
    try {
      const [waitlistRow] = await tursoAuth.select({ totalWaitlist: count() }).from(waitlist);
      totalWaitlist = waitlistRow?.totalWaitlist || 0;
    } catch (e) {
      console.warn("Could not query waitlist count, defaulting to 0:", e);
    }

    const stats = {
      games: catalogStats.totalVisibleGames,
      developers: catalogStats.totalDevelopers,
      publishers: catalogStats.totalPublishers,
      tags: catalogStats.totalTags,
      screenshots: catalogStats.totalScreenshots,
      waitlist: totalWaitlist,
    };

    return new Response(
      JSON.stringify(stats),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("❌ Failed to fetch database stats:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch database stats" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
