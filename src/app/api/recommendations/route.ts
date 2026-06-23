import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "4");
    
    let excludeGameIds: string[] = [];
    let reasonString = "Personalized for you";
    let seedGameId: string | null = null;

    const supabase = getSupabaseServer();
    const user = await getServerUser();
    
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
      return NextResponse.json({ games: [], reason: null });
    }

    // Query precomputed recommendations
    let recommendations;

    if (searchParams.get("tags") && !user) {
      const { data } = await supabase
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
        .not("recommendedGameId", "in", `(${excludeGameIds.join(",")})`)
        .order("distance", { ascending: true })
        .limit(limit);
      
      recommendations = data || [];
    } else {
      const { data } = await supabase
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
        .not("recommendedGameId", "in", `(${excludeGameIds.join(",")})`)
        .order("distance", { ascending: true })
        .limit(limit);
      
      recommendations = data || [];
    }

    const recommendedGames = recommendations.map((r: any) => r.recommendedGame);

    if (recommendedGames.length === 0) {
      return NextResponse.json({ games: [], reason: null });
    }

    return NextResponse.json({
      games: recommendedGames,
      reason: reasonString,
    });
    
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
