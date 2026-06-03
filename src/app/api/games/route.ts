import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const tag = searchParams.get("tag")?.trim() || "";
    const cursor = searchParams.get("cursor")?.trim() || "";
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const where: Prisma.GameWhereInput = {};

    // 1. Tag Filtering (Filter by Mood Tag slug)
    if (tag) {
      where.tags = {
        some: {
          slug: tag
        }
      };
    }

    let matchedIds: string[] = [];

    // 2. Server-side Search across title, summary and denormalized relation strings using pg_trgm similarity
    if (search) {
      const rawMatches = await db.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT id FROM "Game"
          WHERE similarity(title, ${search}) > 0.18
             OR similarity(coalesce("developerNames", ''), ${search}) > 0.2
             OR similarity(coalesce("genreNames", ''), ${search}) > 0.2
             OR similarity(coalesce("platformNames", ''), ${search}) > 0.2
          ORDER BY GREATEST(
            similarity(title, ${search}),
            similarity(coalesce("developerNames", ''), ${search})
          ) DESC
          LIMIT 100;
        `
      );
      matchedIds = rawMatches.map(m => m.id);
      where.id = { in: matchedIds };
    }

    // 3. Query Execution with Cursor Pagination
    const games = await db.game.findMany({
      take: limit + 1, // Fetch limit + 1 items
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where,
      include: {
        developers: true,
        publishers: true,
        genres: true,
        tags: true,
        platforms: true,
        purchaseLinks: true,
      },
      orderBy: {
        releaseDate: "desc",
      },
    });

    // If searching, sort in-memory to preserve relevance order from the raw similarity query
    if (search && matchedIds.length > 0) {
      games.sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id));
    }

    let nextCursor: string | null = null;
    if (games.length > limit) {
      const nextItem = games.pop(); // Pop the extra element and set as next cursor
      nextCursor = nextItem ? nextItem.id : null;
    }

    const totalCount = await db.game.count();

    return NextResponse.json({
      games,
      nextCursor,
      totalCount
    });
  } catch (error) {
    console.error("❌ Failed to fetch games from database:", error);
    return NextResponse.json(
      { error: "Failed to fetch games from database" },
      { status: 500 }
    );
  }
}
