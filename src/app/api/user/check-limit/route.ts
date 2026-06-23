import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from("User")
      .select("*", { count: "exact", head: true });

    const userCount = count ?? 0;
    const capped = userCount >= 10000;

    return NextResponse.json(
      { capped, count: userCount },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("❌ Failed to check user limit:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ capped: false, count: 0 });
  }
}
