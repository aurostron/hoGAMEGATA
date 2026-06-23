import { NextResponse, NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();

    const { count } = await supabase
      .from("Game")
      .select("*", { count: "exact", head: true });

    if (!count || count === 0) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const randomIndex = Math.floor(Math.random() * count);
    const { data } = await supabase
      .from("Game")
      .select("slug")
      .range(randomIndex, randomIndex)
      .limit(1)
      .maybeSingle();

    if (!data?.slug) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.redirect(new URL(`/game/${data.slug}`, request.url));
  } catch (error) {
    console.error("❌ Random redirect failed:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
