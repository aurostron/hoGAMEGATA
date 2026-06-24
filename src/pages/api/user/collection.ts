import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { getServerUser } from '../../../lib/serverAuth';

export const prerender = false;

const VALID_STATUSES = ["OWNED", "PLAYING", "COMPLETED", "WANT_TO_PLAY"] as const;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const user = await getServerUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { data: collectionItems, error } = await supabase
      .from("Collection")
      .select("status, createdAt, game:Game(*)")
      .eq("userId", user.id)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    const collectionGames = (collectionItems || [])
      .map((item: any) => ({
        status: item.status,
        game: item.game,
      }))
      .filter((item: any) => !!item.game);

    return new Response(JSON.stringify({ collection: collectionGames }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Collection fetch failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getServerUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { gameId, status } = await request.json();
    if (!gameId || !status) {
      return new Response(JSON.stringify({ error: "Missing gameId or status" }), { status: 400 });
    }

    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return new Response(JSON.stringify({ error: "Invalid status value" }), { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Upsert: insert or update on conflict
    const { error } = await supabase
      .from("Collection")
      .upsert(
        { userId: user.id, gameId, status },
        { onConflict: "userId,gameId" }
      );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Collection update failed:", error instanceof Error ? error.message : "Unknown error");
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
      .from("Collection")
      .delete()
      .eq("userId", user.id)
      .eq("gameId", gameId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Collection delete failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
