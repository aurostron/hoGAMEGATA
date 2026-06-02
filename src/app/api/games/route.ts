import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const games = await db.game.findMany({
      include: {
        developers: true,
        publishers: true,
        genres: true,
        platforms: true,
        purchaseLinks: true,
      },
      orderBy: {
        releaseDate: "desc",
      },
    });
    return NextResponse.json(games);
  } catch (error) {
    console.error("❌ Failed to fetch games from database:", error);
    return NextResponse.json(
      { error: "Failed to fetch games from database" },
      { status: 500 }
    );
  }
}
