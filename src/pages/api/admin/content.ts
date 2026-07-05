import type { APIRoute } from 'astro';
import { getServerUser } from '../../../lib/serverAuth';
import { turso } from '../../../lib/turso';
import { siteContent } from '../../../db/schema';
import { eq } from 'drizzle-orm';

let cfEnv: any = null;
try {
  const { env } = await import("cloudflare:workers");
  cfEnv = env;
} catch (e) {}

export const prerender = false;

export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Verify session and Admin rights
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const adminEmailsStr = cfEnv?.ADMIN_EMAILS || process.env.ADMIN_EMAILS || "";
    const adminEmails = adminEmailsStr.split(",").map(e => e.trim().toLowerCase());

    const isAdmin = (
      adminEmails.includes(user.email.toLowerCase()) || 
      user.email === "bapum@example.com" ||
      user.email.endsWith("@gamegata.xyz") ||
      import.meta.env?.DEV ||
      process.env.NODE_ENV === "development"
    );

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden. Admin access required." }), { status: 403 });
    }

    // 2. Process request body
    const { key, value } = await request.json();
    if (!key || value === undefined) {
      return new Response(JSON.stringify({ error: "Missing key or value" }), { status: 400 });
    }

    // 3. Update in Turso
    await turso
      .update(siteContent)
      .set({
        value: value,
        updatedAt: new Date(),
        updatedBy: user.email
      })
      .where(eq(siteContent.key, key));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Failed to update site content:", error);
    return new Response(JSON.stringify({ error: "Failed to update site content" }), { status: 500 });
  }
};
