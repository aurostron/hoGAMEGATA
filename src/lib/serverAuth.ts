import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createServerClient } from "@supabase/ssr";

export async function getServerUser() {
  const cookieStore = await cookies();

  // 1. Check Mock Session first
  const mockSession = cookieStore.get("gamegata-session");
  if (mockSession?.value) {
    try {
      const decoded = decodeURIComponent(mockSession.value);
      const [id, email] = decoded.split(":");
      if (id && email) {
        // Ensure user exists in database
        await db.user.upsert({
          where: { id },
          update: { email },
          create: { id, email },
        });
        return { id, email };
      }
    } catch (e) {
      console.error("Error reading server mock session cookie:", e);
    }
  }

  // 2. Check Supabase Session if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
        await db.user.upsert({
          where: { id: user.id },
          update: { email: user.email || "" },
          create: { id: user.id, email: user.email || "" },
        });
        return { id: user.id, email: user.email || "" };
      }
    } catch (err) {
      console.error("Supabase server auth resolution failed:", err);
    }
  }

  return null;
}
