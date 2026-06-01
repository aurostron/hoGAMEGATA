import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/waitlist?error=missing_token", request.url));
    }

    // Find the approved waitlist entry
    const entry = await db.waitlist.findUnique({
      where: { token }
    });

    if (!entry) {
      return NextResponse.redirect(new URL("/waitlist?error=invalid_token", request.url));
    }

    if (entry.status !== "APPROVED" && entry.status !== "SENT") {
      return NextResponse.redirect(new URL("/waitlist?error=not_approved", request.url));
    }

    // Mock Login session creation
    // Generate a deterministic mock user ID based on email
    const mockId = "mock-" + Math.abs(entry.email.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)).toString(16);
    const cookieVal = encodeURIComponent(`${mockId}:${entry.email}`);

    // Set cookie on server side
    const cookieStore = await cookies();
    cookieStore.set("gamegata-session", cookieVal, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    // Ensure user exists in user table
    await db.user.upsert({
      where: { id: mockId },
      update: { email: entry.email },
      create: { id: mockId, email: entry.email }
    });

    // Update waitlist entry status to SENT (active)
    await db.waitlist.update({
      where: { id: entry.id },
      data: { status: "SENT" }
    });

    // Redirect to home page
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("❌ Token login failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.redirect(new URL("/waitlist?error=server_error", request.url));
  }
}
