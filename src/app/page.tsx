
import { Suspense } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import SettingsButton from "@/components/SettingsButton";
import SciFiLogo from "@/components/SciFiLogo";
import GameCatalogClient from "@/components/GameCatalogClient";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getDbStats, getCheapestSnapshots } from "@/lib/dbRpc";


export const dynamic = 'force-dynamic';

export interface StatsData {
  games: number;
  developers: number;
  publishers: number;
  tags: number;
  screenshots: number;
}

export default async function Page() {
  const supabase = getSupabaseServer();

  const stats = await getDbStats();

  const gameSummarySelect = "id, title, slug, coverUrl, releaseDate, rating, genreNames, platformNames, tags:Tag(name, slug)";

  let initialGames: any[] = [];
  let nextCursor: string | null = null;

  try {
    const { data: fetchedGames } = await supabase
      .from("Game")
      .select(gameSummarySelect)
      .order("releaseDate", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .limit(21);

    if (fetchedGames) {
      const limit = 20;
      initialGames = fetchedGames.slice(0, limit);
      if (fetchedGames.length > limit) {
        const lastGame = initialGames[initialGames.length - 1];
        nextCursor = lastGame ? `${lastGame.releaseDate ? new Date(lastGame.releaseDate).getTime() : "null"}_${lastGame.id}` : null;
      }

      const gameIds = initialGames.map((g: any) => g.id);
      if (gameIds.length > 0) {
        const snapshots = await getCheapestSnapshots(gameIds);
        const snapshotMap = new Map<string, any[]>();
        for (const row of snapshots) {
          const { gameId, ...snapshot } = row;
          if (!snapshotMap.has(gameId)) snapshotMap.set(gameId, []);
          snapshotMap.get(gameId)!.push(snapshot);
        }
        for (const game of initialGames) {
          game.priceSnapshots = snapshotMap.get(game.id) || [];
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch initial games:", err);
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <SciFiLogo withLink={false} />
            <div className="flex items-center gap-2 font-mono text-[12px] tracking-widest text-white uppercase font-bold">
              <span>Horror</span>
              <span className="text-white font-black">•</span>
              <span>Game</span>
              <span className="text-white font-black">•</span>
              <span>Mega</span>
              <span className="text-white font-black">•</span>
              <span>Metadata</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SettingsButton />
          </div>
        </div>
      </header>

      {/* Atmospheric Hero Banner */}
      <div className="relative w-full overflow-hidden" style={{minHeight: "320px"}}>
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0" style={{background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(180,0,0,0.13) 0%, transparent 70%)"}} />
        <div className="absolute inset-0" style={{background: "radial-gradient(ellipse 50% 40% at 20% 100%, rgba(80,0,0,0.10) 0%, transparent 60%)"}} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 flex flex-col items-center justify-center text-center py-16 gap-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.05] tracking-tight max-w-3xl">
            Probably the most curated horror games database
            <span className="text-white/75"> you&apos;ll ever see.</span>
          </h1>

          <div className="flex flex-nowrap justify-center gap-px mt-4 border border-white/35 font-mono min-h-[74px] md:min-h-[82px] w-full max-w-[600px]">
            {stats ? (
              [
                { label: "Games", value: stats.games },
                { label: "Devs", value: stats.developers },
                { label: "Screenshots", value: stats.screenshots },
                { label: "Game Tags", value: stats.tags },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center justify-center px-4 md:px-6 py-4 bg-white/[0.03] hover:bg-white/[0.06] transition-colors duration-200 border-r border-white/10 last:border-r-0 flex-1">
                  <span className="text-2xl md:text-3xl font-black text-white tabular-nums">
                    {stat.value.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-white/60 uppercase tracking-widest mt-0.5 text-center">{stat.label}</span>
                </div>
              ))
            ) : (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center justify-center px-4 md:px-6 py-4 bg-white/[0.01] border-r border-white/10 last:border-r-0 flex-1">
                  <div className="h-7 md:h-9 bg-white/10 w-12 md:w-16 mb-1 rounded-sm animate-pulse" />
                  <div className="h-2.5 bg-white/5 w-10 md:w-14 rounded-sm mt-0.5 animate-pulse" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>


      <main className="max-w-5xl mx-auto px-6 mt-10 space-y-12">
        <Suspense fallback={<div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">[ INITIALIZING SYSTEMS... ]</div>}>
          <GameCatalogClient
            initialGames={initialGames}
            initialTotalGames={null}
            initialNextCursor={nextCursor}
          />
        </Suspense>
      </main>
    </div>
  );
}
