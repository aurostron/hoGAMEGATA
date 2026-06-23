import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/serverAuth";

const VALID_STATUSES = ["OWNED", "PLAYING", "COMPLETED", "WANT_TO_PLAY"] as const;

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId, status } = await request.json();
    if (!gameId || !status) {
      return NextResponse.json({ error: "Missing gameId or status" }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Collection update failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await request.json();
    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("Collection")
      .delete()
      .eq("userId", user.id)
      .eq("gameId", gameId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Collection delete failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
