import type { APIRoute } from 'astro';
import { turso } from '../../lib/turso';
import { tursoAuth } from '../../lib/tursoAuth';
import { games, developers, publishers, tags } from '../../db/schema';
import { waitlist } from '../../db/auth-schema';
import { count } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [
      [{ totalGames }],
      [{ totalDevs }],
      [{ totalPublishers }],
      [{ totalTags }],
      [{ totalWaitlist }],
    ] = await Promise.all([
      turso.select({ totalGames: count() }).from(games),
      turso.select({ totalDevs: count() }).from(developers),
      turso.select({ totalPublishers: count() }).from(publishers),
      turso.select({ totalTags: count() }).from(tags),
      tursoAuth.select({ totalWaitlist: count() }).from(waitlist),
    ]);

    const stats = {
      games: totalGames,
      developers: totalDevs,
      publishers: totalPublishers,
      tags: totalTags,
      screenshots: totalGames * 4, // estimate screenshots based on games count
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
