import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../lib/supabaseServer';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
  try {
    const supabase = getSupabaseServer();

    const { count } = await supabase
      .from("Game")
      .select("*", { count: "exact", head: true });

    if (!count || count === 0) {
      return redirect("/");
    }

    const randomIndex = Math.floor(Math.random() * count);
    const { data } = await supabase
      .from("Game")
      .select("slug")
      .range(randomIndex, randomIndex)
      .limit(1)
      .maybeSingle();

    if (!data?.slug) {
      return redirect("/");
    }

    return redirect(`/game/${data.slug}`);
  } catch (error) {
    console.error("❌ Random redirect failed:", error);
    return redirect("/");
  }
};
