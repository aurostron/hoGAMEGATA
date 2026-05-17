import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerUser } from "@/lib/serverAuth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { id, email } = await request.json();
    if (!id || !email) {
      return NextResponse.json({ error: "Missing id or email" }, { status: 400 });
    }

    // Auth check: verify the caller is syncing their own data
    const existingUser = await getServerUser();
    if (existingUser) {
      // Authenticated user can only sync their own record
      if (existingUser.id !== id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      // For initial mock login bootstrap: verify the session cookie matches
      const cookieStore = await cookies();
      const mockSession = cookieStore.get("gamegata-session");
      if (!mockSession?.value) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      try {
        const decoded = decodeURIComponent(mockSession.value);
        const [cookieId, cookieEmail] = decoded.split(":");
        if (cookieId !== id || cookieEmail !== email) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const user = await db.user.upsert({
      where: { id },
      update: { email },
      create: { id, email },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("❌ Failed to sync user:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
