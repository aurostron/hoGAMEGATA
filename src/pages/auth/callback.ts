import type { APIRoute } from 'astro';
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServer } from '../../lib/supabaseServer';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabaseUrl = import.meta.env?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Supabase environment variables are missing during OAuth callback.");
      return new Response(null, { status: 302, headers: { Location: `${origin}/login?error=auth_failed` } });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookies.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookies.set(name, value, options)
            );
          } catch {
            // Ignore if header modifications are restricted
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          const db = getSupabaseServer();

          // Check user limit
          const { count } = await db
            .from("User")
            .select("*", { count: "exact", head: true });

          if ((count ?? 0) >= 10000) {
            const { data: existing } = await db
              .from("User")
              .select("id")
              .eq("id", user.id)
              .limit(1)
              .maybeSingle();

            if (!existing) {
              console.warn(`⚠️ User limit reached. Denying signup for user ${user.id}`);
              await supabase.auth.signOut();
              return new Response(null, { status: 302, headers: { Location: `${origin}/login?error=limit_reached` } });
            }
          }

          // Sync user to database
          const { error: upsertError } = await db
            .from("User")
            .upsert(
              { id: user.id, email: user.email || "" },
              { onConflict: "id" }
            );

          if (upsertError) {
            console.error("❌ Sync error during OAuth callback:", upsertError);
            await supabase.auth.signOut();
            return new Response(null, { status: 302, headers: { Location: `${origin}/login?error=limit_reached` } });
          }
        } catch (syncError) {
          console.error("❌ Sync error during OAuth callback:", syncError);
          await supabase.auth.signOut();
          return new Response(null, { status: 302, headers: { Location: `${origin}/login?error=limit_reached` } });
        }
      }

      return new Response(null, { status: 302, headers: { Location: `${origin}${next}` } });
    } else {
      console.error("❌ OAuth code exchange error:", error.message);
    }
  }

  return new Response(null, { status: 302, headers: { Location: `${origin}/login?error=auth_failed` } });
};
