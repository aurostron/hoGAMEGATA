import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/serverAuth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { id, email } = await request.json();
    if (!id || !email) {
      return NextResponse.json({ error: "Missing id or email" }, { status: 400 });
    }

    // Auth check: verify the caller is syncing their own data
    const existingUser = await getServerUser();
    if (existingUser) {
      if (existingUser.id !== id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      // For initial mock login bootstrap: verify the session cookie matches
      const cookieStore = await cookies();
      const mockSession = cookieStore.get("gamegata-session");
      if (!mockSession?.value) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      try {
        const decoded = decodeURIComponent(mockSession.value);
        const [cookieId, cookieEmail] = decoded.split(":");
        if (cookieId !== id || cookieEmail !== email) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json(
          { error: "Registration limit of 10,000 users has been reached." },
          { status: 403 }
        );
      }
    }

    // Upsert user
    const { error } = await supabase
      .from("User")
      .upsert({ id, email }, { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({ success: true, user: { id, email } });
  } catch (error) {
    console.error("❌ Failed to sync user:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
