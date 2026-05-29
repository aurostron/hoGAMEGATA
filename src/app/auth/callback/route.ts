import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

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
      // Exchange successful. Now check if the user is allowed (limit check)
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          const count = await db.user.count();
          if (count >= 10000) {
            const existing = await db.user.findUnique({ where: { id: user.id } });
            if (!existing) {
              console.warn(`⚠️ User limit reached. Denying signup for user ${user.id}`);
              // Sign out from Supabase Auth to destroy session
              await supabase.auth.signOut();
              return NextResponse.redirect(`${origin}/login?error=limit_reached`);
            }
          }

          // Sync user to database
          await db.user.upsert({
            where: { id: user.id },
            update: { email: user.email || "" },
            create: { id: user.id, email: user.email || "" },
          });
        } catch (syncError) {
          console.error("❌ Sync error during OAuth callback:", syncError);
          // If trigger failed, it will raise an exception, indicating cap reached or DB error
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
