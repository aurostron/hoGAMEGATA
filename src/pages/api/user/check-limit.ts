import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from("User")
      .select("*", { count: "exact", head: true });

    const userCount = count ?? 0;
    const capped = userCount >= 10000;

    return new Response(
      JSON.stringify({ capped, count: userCount }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("❌ Failed to check user limit:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ capped: false, count: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
};
