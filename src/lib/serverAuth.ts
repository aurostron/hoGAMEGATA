import { createServerClient } from "@supabase/ssr";
import { getSupabaseServer } from "./supabaseServer";

export async function getServerUser(cookies: any) {
  const supabaseUrl = import.meta.env?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Check Supabase Session first (production auth)
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabaseServer = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return cookies.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookies.set(name, value, options)
                );
              } catch (e) {
                // Ignore set failures if called during operations that don't allow header changes
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

    return null;
  }

  // 2. Mock session fallback (development only — when Supabase is not configured)
  const mockSession = cookies.get("gamegata-session");
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
