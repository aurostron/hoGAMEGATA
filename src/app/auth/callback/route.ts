import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Supabase environment variables are missing during OAuth callback.");
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
            // Can be ignored if middleware handles session refreshing
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
              return NextResponse.redirect(`${origin}/login?error=limit_reached`);
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
            return NextResponse.redirect(`${origin}/login?error=limit_reached`);
          }
        } catch (syncError) {
          console.error("❌ Sync error during OAuth callback:", syncError);
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=limit_reached`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("❌ OAuth code exchange error:", error.message);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
