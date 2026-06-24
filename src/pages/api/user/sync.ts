import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { getServerUser } from '../../../lib/serverAuth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { id, email } = await request.json();
    if (!id || !email) {
      return new Response(JSON.stringify({ error: "Missing id or email" }), { status: 400 });
    }

    // Auth check: verify the caller is syncing their own data
    const existingUser = await getServerUser(cookies);
    
    if (existingUser) {
      if (existingUser.id !== id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    } else {
      // For initial mock login bootstrap: verify the session cookie matches
      const mockSession = cookies.get("gamegata-session");
      if (!mockSession?.value) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      try {
        const decoded = decodeURIComponent(mockSession.value);
        const [cookieId, cookieEmail] = decoded.split(":");
        if (cookieId !== id || cookieEmail !== email) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
    }

    const supabase = getSupabaseServer();

    // Enforce 10,000 user limit
    const { count } = await supabase
      .from("User")
      .select("*", { count: "exact", head: true });

    if ((count ?? 0) >= 10000) {
      const { data: existing } = await supabase
        .from("User")
        .select("id")
        .eq("id", id)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Registration limit of 10,000 users has been reached." }),
          { status: 403 }
        );
      }
    }

    // Upsert user
    const { error } = await supabase
      .from("User")
      .upsert({ id, email }, { onConflict: "id" });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, user: { id, email } }), { status: 200 });
  } catch (error) {
    console.error("❌ Failed to sync user:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
