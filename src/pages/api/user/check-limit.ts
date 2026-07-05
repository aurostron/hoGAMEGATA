import type { APIRoute } from 'astro';
import { tursoAuth } from '../../../lib/tursoAuth';
import { count } from 'drizzle-orm';
import { user } from '../../../db/auth-schema';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [{ value }] = await tursoAuth
      .select({ value: count() })
      .from(user);

    const capped = value >= 10000;
    return new Response(
      JSON.stringify({ capped, count: value }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("Failed to query user limit status in check-limit API:", err);
    // Return uncapped on error/bypass
    return new Response(
      JSON.stringify({ capped: false, count: 0 }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
};
