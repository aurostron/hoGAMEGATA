import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerUser } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ loggedIn: false });
    }

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const [wishlistRecord, collectionRecord] = await Promise.all([
      db.wishlist.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId,
          },
        },
      }),
      db.collection.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId,
          },
        },
      })
    ]);

    return NextResponse.json({
      loggedIn: true,
      wishlisted: !!wishlistRecord,
      collectionStatus: collectionRecord ? collectionRecord.status : null
    });
  } catch (error) {
    console.error("❌ Failed to resolve user status for game:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
