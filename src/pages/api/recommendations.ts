import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabaseServer';
import { getServerUser } from '../../lib/serverAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "4", 10);
    
    let excludeGameIds: string[] = [];
    let reasonString = "Personalized for you";
    let seedGameId: string | null = null;

    const supabase = getSupabaseServer();
    const user = await getServerUser(cookies);
    
    if (user) {
      // Get most recent wishlist item as seed
      const { data: latestWishlist } = await supabase
        .from("Wishlist")
        .select("gameId, game:Game!inner(title)")
        .eq("userId", user.id)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestWishlist) {
        seedGameId = latestWishlist.gameId;
        const gameTitle = (latestWishlist.game as any)?.title;
        reasonString = `Because you wishlisted ${gameTitle}`;
        
        // Exclude all wishlisted and collected games
        const [wishlistResult, collectionResult] = await Promise.all([
          supabase.from("Wishlist").select("gameId").eq("userId", user.id),
          supabase.from("Collection").select("gameId").eq("userId", user.id),
        ]);
        
        excludeGameIds = [
          ...(wishlistResult.data || []).map((w: any) => w.gameId),
          ...(collectionResult.data || []).map((c: any) => c.gameId),
        ];
      }
    }

    // Fallback to client-side affinities
    if (!seedGameId) {
      const clientTagsParam = searchParams.get("tags");
      if (clientTagsParam) {
        const topTags = clientTagsParam.split(",").filter(t => t.trim() !== "");
        if (topTags.length > 0) {
          // Find a highly rated game matching their favorite vibe
          const { data: seedCandidate } = await supabase
            .from("Game")
            .select("id")
            .or(`tags.slug.eq.${topTags[0]},genres.slug.eq.${topTags[0]}`)
            .order("rating", { ascending: false, nullsFirst: true })
            .limit(1)
            .maybeSingle();
          
          if (seedCandidate) {
            seedGameId = seedCandidate.id;
            reasonString = `Because you like ${topTags[0].replace(/-/g, " ")} vibes`;
            excludeGameIds.push(seedCandidate.id);
          }
        }
      }
    }

    if (!seedGameId) {
      return new Response(JSON.stringify({ games: [], reason: null }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Query precomputed recommendations
    let recommendations;
    
    // Build exclusion filter string
    const exclusionFilter = excludeGameIds.length > 0
      ? `(${excludeGameIds.join(",")})`
      : null;

    let query = supabase
      .from("GameRecommendation")
      .select(`
        distance,
        recommendedGame:Game!inner(
          *,
          developers:Developer(id, name, slug),
          genres:Genre(id, name, slug),
          tags:Tag(id, name, slug),
          platforms:Platform(id, name, slug)
        )
      `)
      .eq("gameId", seedGameId)
      .order("distance", { ascending: true })
      .limit(limit);

    if (exclusionFilter) {
      query = query.not("recommendedGameId", "in", exclusionFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    recommendations = data || [];

    const recommendedGames = recommendations.map((r: any) => r.recommendedGame);

    if (recommendedGames.length === 0) {
      return new Response(JSON.stringify({ games: [], reason: null }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({
        games: recommendedGames,
        reason: reasonString,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Recommendations error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch recommendations" }), { status: 500 });
  }
};
