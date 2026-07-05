import type { APIRoute } from 'astro';
import { tursoAuth } from '../../../lib/tursoAuth';
import { waitlist as waitlistTable } from '../../../db/auth-schema';
import { eq } from 'drizzle-orm';

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

    const normalizedEmail = email.toLowerCase();

    // Check if email already exists in separate Auth Database
    const existing = await tursoAuth
      .select({ id: waitlistTable.id })
      .from(waitlistTable)
      .where(eq(waitlistTable.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return new Response(JSON.stringify({ success: true, message: "Already joined" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Generate secure random access token
    const token = crypto.randomUUID();
    const entryId = crypto.randomUUID();

    // Create waitlist entry in separate Auth Database
    await tursoAuth
      .insert(waitlistTable)
      .values({
        id: entryId,
        email: normalizedEmail,
        token,
        status: "PENDING",
      });

    return new Response(JSON.stringify({ success: true, id: entryId }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("❌ Failed to join waitlist:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
