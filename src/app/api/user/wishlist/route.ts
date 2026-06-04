import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerUser } from "@/lib/serverAuth";

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await request.json();
    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const record = await db.wishlist.upsert({
      where: {
        userId_gameId: {
          userId: user.id,
          gameId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        gameId,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("❌ Wishlist add failed:", error instanceof Error ? error.message : "Unknown error");
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

    // Use deleteMany or check existence to prevent crashing if it does not exist
    await db.wishlist.deleteMany({
      where: {
        userId: user.id,
        gameId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Wishlist delete failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
