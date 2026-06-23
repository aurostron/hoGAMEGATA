import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ loggedIn: false });
    }

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
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

    return NextResponse.json({
      loggedIn: true,
      wishlisted: !!wishlistResult.data,
      collectionStatus: collectionResult.data?.status || null,
    });
  } catch (error) {
    console.error("❌ Failed to resolve user status for game:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
