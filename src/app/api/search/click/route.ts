import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { query, gameId, position } = await request.json();

    if (!query || !gameId || typeof position !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const logEntry = await db.searchClick.create({
      data: {
        query: query.trim(),
        gameId,
        position,
      },
    });

    return NextResponse.json({ success: true, id: logEntry.id });
  } catch (error) {
    console.error("❌ Search click logging failed:", error);
    return NextResponse.json({ error: "Failed to log search click" }, { status: 500 });
  }
}
