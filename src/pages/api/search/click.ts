import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { query, gameId, position } = await request.json();

    if (!query || !gameId || typeof position !== "number") {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

        const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("SearchClick")
      .insert({
        id: crypto.randomUUID(),
        query: query.trim(),
        gameId,
        position,
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Search click logging failed:", error);
    return new Response(JSON.stringify({ error: "Failed to log search click" }), { status: 500 });
  }
};
