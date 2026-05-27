import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [gameCount, devCount, pubCount, tagCount] = await Promise.all([
      db.game.count(),
      db.developer.count(),
      db.publisher.count(),
      db.tag.count(),
    ]);

    // Count total screenshots stored across PostgreSQL string arrays
    const screenshotResult = await db.$queryRaw<{ sum: number | null }[]>`
      SELECT SUM(cardinality(screenshots))::int as sum FROM "Game";
    `;
    const screenshotCount = screenshotResult[0]?.sum ?? 0;

    return NextResponse.json({
      games: gameCount,
      developers: devCount,
      publishers: pubCount,
      tags: tagCount,
      screenshots: screenshotCount,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    console.error("❌ Failed to fetch database stats:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to fetch database stats" },
      { status: 500 }
    );
  }
}
