import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { createServerClient } from "@supabase/ssr";

export async function getServerUser() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Check Supabase Session first (production auth)
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabaseServer = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // The `setAll` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing sessions.
              }
            },
          },
        }
      );

      const { data: { user } } = await supabaseServer.auth.getUser();
      if (user) {
        // Sync user to local DB
        try {
          const db = getSupabaseServer();
          await db
            .from("User")
            .upsert(
              { id: user.id, email: user.email || "" },
              { onConflict: "id" }
            );
        } catch (upsertErr) {
          console.warn("User sync upsert failed (likely email constraint), ignoring:", upsertErr instanceof Error ? upsertErr.message : String(upsertErr));
        }
        return { id: user.id, email: user.email || "" };
      }
    } catch (err) {
      console.error("Supabase server auth resolution failed:", err instanceof Error ? err.message : "Unknown error");
    }

    // Supabase is configured but no session found — do NOT fall through to mock auth
    return null;
  }

  // 2. Mock session fallback (development only — when Supabase is not configured)
  const mockSession = cookieStore.get("gamegata-session");
  if (mockSession?.value) {
    try {
      const decoded = decodeURIComponent(mockSession.value);
      const [id, email] = decoded.split(":");
      if (id && email) {
        const db = getSupabaseServer();
        await db
          .from("User")
          .upsert(
            { id, email },
            { onConflict: "id" }
          );
        return { id, email };
      }
    } catch (e) {
      console.error("Error reading server mock session cookie:", e instanceof Error ? e.message : "Unknown error");
    }
  }

  return null;
}
