import { NextResponse } from "next/server";
import { getDbStats } from "@/lib/dbRpc";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getDbStats();

    if (!stats) {
      return NextResponse.json(
        { error: "Failed to fetch database stats" },
        { status: 500 }
      );
    }

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("❌ Failed to fetch database stats:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to fetch database stats" },
      { status: 500 }
    );
  }
}
