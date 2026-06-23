import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { getServerUser } from '../../../lib/serverAuth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const user = await getServerUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { data: wishlistItems, error } = await supabase
      .from("Wishlist")
      .select("createdAt, game:Game(*)")
      .eq("userId", user.id)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    const wishlistGames = (wishlistItems || [])
      .map((item: any) => item.game)
      .filter(Boolean);

    return new Response(JSON.stringify({ wishlist: wishlistGames }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist fetch failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { gameId } = await request.json();
    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Upsert: try insert, ignore if already exists
    const { error } = await supabase
      .from("Wishlist")
      .upsert(
        { id: crypto.randomUUID(), userId: user.id, gameId },
        { onConflict: "userId,gameId", ignoreDuplicates: true }
      );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist add failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { gameId } = await request.json();
    if (!gameId) {
      return new Response(JSON.stringify({ error: "Missing gameId" }), { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("Wishlist")
      .delete()
      .eq("userId", user.id)
      .eq("gameId", gameId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Wishlist delete failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
