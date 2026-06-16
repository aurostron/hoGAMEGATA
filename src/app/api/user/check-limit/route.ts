import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await db.user.count();
    const capped = count >= 10000;

    return NextResponse.json(
      { capped, count },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("❌ Failed to check user limit:", error instanceof Error ? error.message : "Unknown error");
    // If the database is not ready or configured, default to not capped so mock mode works
    return NextResponse.json({ capped: false, count: 0 });
  }
}
