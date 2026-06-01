import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    // Simple email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
    }

    // Check if email already exists in waitlist
    const existing = await db.waitlist.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existing) {
      return NextResponse.json({ success: true, message: "Already joined" });
    }

    // Generate secure random access token
    const token = crypto.randomBytes(32).toString("hex");

    // Create waitlist entry
    const entry = await db.waitlist.create({
      data: {
        email: email.toLowerCase(),
        token,
        status: "PENDING"
      }
    });

    return NextResponse.json({ success: true, id: entry.id });
  } catch (error) {
    console.error("❌ Failed to join waitlist:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
