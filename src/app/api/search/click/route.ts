import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const { query, gameId, position } = await request.json();

    if (!query || !gameId || typeof position !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("SearchClick")
      .insert({
        query: query.trim(),
        gameId,
        position,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("❌ Search click logging failed:", error);
    return NextResponse.json({ error: "Failed to log search click" }, { status: 500 });
  }
}
