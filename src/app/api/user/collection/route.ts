import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerUser } from "@/lib/serverAuth";
import { CollectionStatus } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId, status } = await request.json();
    if (!gameId || !status) {
      return NextResponse.json({ error: "Missing gameId or status" }, { status: 400 });
    }

    // Verify valid status enum value
    if (!Object.values(CollectionStatus).includes(status as CollectionStatus)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const record = await db.collection.upsert({
      where: {
        userId_gameId: {
          userId: user.id,
          gameId,
        },
      },
      update: {
        status: status as CollectionStatus,
      },
      create: {
        userId: user.id,
        gameId,
        status: status as CollectionStatus,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("❌ Collection update failed:", error);
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

    await db.collection.deleteMany({
      where: {
        userId: user.id,
        gameId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Collection delete failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
