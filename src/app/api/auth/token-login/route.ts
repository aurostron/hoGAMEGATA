import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/waitlist?error=missing_token", request.url));
    }

    const supabase = getSupabaseServer();

    // Find the approved waitlist entry
    const { data: entry } = await supabase
      .from("Waitlist")
      .select("id, email, status")
      .eq("token", token)
      .limit(1)
      .maybeSingle();

    if (!entry) {
      return NextResponse.redirect(new URL("/waitlist?error=invalid_token", request.url));
    }

    if (entry.status !== "APPROVED" && entry.status !== "SENT") {
      return NextResponse.redirect(new URL("/waitlist?error=not_approved", request.url));
    }

    // Mock Login session creation
    const mockId = "mock-" + Math.abs(entry.email.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)).toString(16);
    const cookieVal = encodeURIComponent(`${mockId}:${entry.email}`);

    const cookieStore = await cookies();
    cookieStore.set("gamegata-session", cookieVal, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // Ensure user exists in user table
    await supabase
      .from("User")
      .upsert({ id: mockId, email: entry.email }, { onConflict: "id" });

    // Update waitlist entry status to SENT
    await supabase
      .from("Waitlist")
      .update({ status: "SENT" })
      .eq("id", entry.id);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("❌ Token login failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.redirect(new URL("/waitlist?error=server_error", request.url));
  }
}
