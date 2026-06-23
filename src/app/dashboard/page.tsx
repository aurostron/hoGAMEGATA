import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseServer } from "@/lib/supabaseServer";
import DashboardTabs from "@/components/DashboardTabs";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AuthButton from "@/components/AuthButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const supabase = getSupabaseServer();

  // Query wishlist
  const { data: wishlistItems } = await supabase
    .from("Wishlist")
    .select("createdAt, game:Game(*)")
    .eq("userId", user.id)
    .order("createdAt", { ascending: false });

  // Query collection items
  const { data: collectionItems } = await supabase
    .from("Collection")
    .select("status, createdAt, game:Game(*)")
    .eq("userId", user.id)
    .order("createdAt", { ascending: false });

  const wishlistedGames = (wishlistItems || []).map((item: any) => item.game);

  const collectionGames = (collectionItems || []).map((item: any) => ({
    status: item.status,
    game: item.game,
  }));

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      {/* Header */}
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link href="/" className="hover:opacity-85">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                <span className="italic">ho</span>GAMEGATA.
              </h1>
            </Link>
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-white uppercase font-bold">
              <span>Personal Console</span>
              <span className="text-white font-black">•</span>
              <span>Developer Registry</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthButton />
            <Link 
              href="/" 
              className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ Back to Search ]</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        <section className="pb-8 border-b border-white space-y-2">
          <span className="font-mono text-[9px] text-white uppercase tracking-widest border border-white px-2 py-0.5 font-bold bg-white text-black w-fit block">
            Terminal Active
          </span>
          <h2 className="text-3xl font-extrabold uppercase tracking-tight">
            Dashboard Specs: {user.email}
          </h2>
          <p className="text-xs text-white/60 font-mono uppercase tracking-wider">
            Access credentials: {user.id}
          </p>
        </section>

        <DashboardTabs
          wishlist={wishlistedGames}
          collection={collectionGames}
        />
      </main>
    </div>
  );
}
