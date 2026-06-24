import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email address is required" }), { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address format" }), { status: 400 });
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
      return new Response(JSON.stringify({ success: true, message: "Already joined" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Generate secure random access token
    const token = crypto.randomUUID();

    // Create waitlist entry
    const { data, error } = await supabase
      .from("Waitlist")
      .insert({
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        token,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Failed to join waitlist:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
