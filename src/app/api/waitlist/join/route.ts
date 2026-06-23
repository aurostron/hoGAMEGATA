import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Check if email already exists
    const { data: existing } = await supabase
      .from("Waitlist")
      .select("id")
      .eq("email", email.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, message: "Already joined" });
    }

    // Generate secure random access token
    const token = crypto.randomBytes(32).toString("hex");

    // Create waitlist entry
    const { data, error } = await supabase
      .from("Waitlist")
      .insert({
        email: email.toLowerCase(),
        token,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("❌ Failed to join waitlist:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
