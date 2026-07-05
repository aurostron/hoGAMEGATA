import type { APIRoute } from 'astro';
import { tursoAuth } from '../../../lib/tursoAuth';
import { waitlist as waitlistTable, user as userTable } from '../../../db/auth-schema';
import { eq } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/waitlist?error=missing_token" }
      });
    }

    // Find the approved waitlist entry in separate Auth Database
    const entry = await tursoAuth
      .select()
      .from(waitlistTable)
      .where(eq(waitlistTable.token, token))
      .limit(1);

    if (entry.length === 0) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/waitlist?error=invalid_token" }
      });
    }

    const waitlistEntry = entry[0];

    if (waitlistEntry.status !== "APPROVED" && waitlistEntry.status !== "SENT") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/waitlist?error=not_approved" }
      });
    }

    // Mock Login session creation
    const mockId = "mock-" + Math.abs(waitlistEntry.email.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)).toString(16);
    const cookieVal = encodeURIComponent(`${mockId}:${waitlistEntry.email}`);

    cookies.set("gamegata-session", cookieVal, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: import.meta.env.PROD || process.env.NODE_ENV === "production",
    });

    // Ensure user exists in user table in separate Auth Database
    await tursoAuth
      .insert(userTable)
      .values({
        id: mockId,
        name: waitlistEntry.email.split("@")[0],
        email: waitlistEntry.email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Update waitlist entry status to SENT
    await tursoAuth
      .update(waitlistTable)
      .set({ status: "SENT" })
      .where(eq(waitlistTable.id, waitlistEntry.id));

    return new Response(null, {
      status: 302,
      headers: { Location: "/" }
    });
  } catch (error) {
    console.error("❌ Token login failed:", error instanceof Error ? error.message : "Unknown error");
    return new Response(null, {
      status: 302,
      headers: { Location: "/waitlist?error=server_error" }
    });
  }
};
