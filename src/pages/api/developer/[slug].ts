import type { APIRoute } from 'astro';
import { getDeveloperData } from '../../../lib/creatorGamesFetcher';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing developer slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const data = await getDeveloperData(slug);
    if (!data) {
      return new Response(JSON.stringify({ error: "Developer not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
      }
    });
  } catch (err: any) {
    console.error(`[api/developer/${slug}] Unexpected error:`, err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
