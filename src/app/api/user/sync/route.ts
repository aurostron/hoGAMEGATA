import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { id, email } = await request.json();
    if (!id || !email) {
      return NextResponse.json({ error: "Missing id or email" }, { status: 400 });
    }

    const user = await db.user.upsert({
      where: { id },
      update: { email },
      create: { id, email },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("❌ Failed to sync user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
