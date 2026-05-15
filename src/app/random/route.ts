import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const count = await db.game.count();
    if (count === 0) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const randomIndex = Math.floor(Math.random() * count);
    const randomGame = await db.game.findMany({
      take: 1,
      skip: randomIndex,
      select: {
        slug: true,
      },
    });

    if (!randomGame || randomGame.length === 0) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.redirect(new URL(`/game/${randomGame[0].slug}`, request.url));
  } catch (error) {
    console.error("❌ Random redirect failed:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
