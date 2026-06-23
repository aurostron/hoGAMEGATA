import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { getServerUser } from '../../../lib/serverAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ loggedIn: false }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    const supabase = getSupabaseServer();

    const [wishlistResult, collectionResult] = await Promise.all([
      supabase
        .from("Wishlist")
        .select("id")
        .eq("userId", user.id)
        .eq("gameId", gameId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("Collection")
        .select("status")
        .eq("userId", user.id)
        .eq("gameId", gameId)
        .limit(1)
        .maybeSingle(),
    ]);

    return new Response(
      JSON.stringify({
        loggedIn: true,
        wishlisted: !!wishlistResult.data,
        collectionStatus: collectionResult.data?.status || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Failed to resolve user status for game:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
