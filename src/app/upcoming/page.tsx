import Link from "next/link";
import { db } from "@/lib/db";
import AuthButton from "@/components/AuthButton";
import { ArrowLeft, Calendar, ExternalLink, Tag, Monitor } from "lucide-react";
import { getHighResCoverUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UpcomingPage() {
  const now = new Date();

  // Query games that are marked upcoming or have future release dates
  const upcomingGames = await db.game.findMany({
    where: {
      OR: [
        { status: "upcoming" },
        { releaseDate: { gt: now } }
      ]
    },
    orderBy: {
      releaseDate: "asc" // Closest release first
    },
    include: {
      developers: true,
      genres: true,
      tags: true,
      platforms: true,
      purchaseLinks: true
    }
  });

  // Group games by month/year for a chronological timeline
  const groupedGames: { [key: string]: typeof upcomingGames } = {};
  const tbaGames: typeof upcomingGames = [];

  for (const game of upcomingGames) {
    if (game.releaseDate) {
      const date = new Date(game.releaseDate);
      const monthYear = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      if (!groupedGames[monthYear]) {
        groupedGames[monthYear] = [];
      }
      groupedGames[monthYear].push(game);
    } else {
      tbaGames.push(game);
    }
  }

  const sortedMonths = Object.keys(groupedGames).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

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
              <span>Release Calendar</span>
              <span className="text-white font-black">•</span>
              <span>Future Software Mappings</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthButton />
            <Link 
              href="/" 
              className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ Return to Search ]</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-16">
        
        {/* Intro */}
        <section className="pb-8 border-b border-white space-y-2">
          <span className="font-mono text-[9px] text-white uppercase tracking-widest border border-white px-2 py-0.5 font-bold bg-white text-black w-fit block">
            Calendar Active
          </span>
          <h2 className="text-3xl font-extrabold uppercase tracking-tight">
            Upcoming Horror Mappings
          </h2>
          <p className="text-sm text-white/60 font-medium max-w-xl leading-relaxed">
            Track emerging horror developments, release windows, and official storefront links without marketing noise.
          </p>
        </section>

        {/* Timeline Grid */}
        {upcomingGames.length === 0 ? (
          <div className="text-center py-16 border border-white font-mono text-xs text-white uppercase tracking-widest font-bold">
            [ No upcoming horror titles currently indexed ]
          </div>
        ) : (
          <div className="space-y-16">
            {/* Render chronological groups */}
            {sortedMonths.map((month) => (
              <section key={month} className="space-y-6">
                <h3 className="font-mono text-xs text-white border-b border-white pb-2 tracking-widest uppercase font-black">
                  // {month}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groupedGames[month].map((game) => (
                    <div 
                      key={game.id}
                      className="border border-white bg-black p-5 flex gap-5 hover:bg-neutral-950/40 transition-all duration-150"
                    >
                      {/* Image Block */}
                      <div className="w-24 h-32 relative bg-neutral-900 border border-white shrink-0 flex items-center justify-center overflow-hidden">
                        {game.coverUrl ? (
                          <img
                            src={getHighResCoverUrl(game.coverUrl) || ""}
                            alt={game.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">No Cover</span>
                        )}
                      </div>

                      {/* Info Block */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/game/${game.slug}`} className="hover:underline">
                              <h4 className="text-sm font-bold uppercase text-white truncate max-w-[240px]">
                                {game.title}
                              </h4>
                            </Link>
                          </div>
                          
                          <span className="font-mono text-[9px] text-white/60 block font-bold">
                            by {game.developers[0]?.name || "Unknown Developer"}
                          </span>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {game.tags.slice(0, 2).map((t) => (
                              <span key={t.slug} className="font-mono text-[8px] border border-white/30 text-white/80 px-1.5 py-0.2 uppercase font-medium">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-white/20 pt-3 mt-3 flex items-center justify-between font-mono text-[9px]">
                          <span className="flex items-center gap-1 font-bold text-white uppercase">
                            <Calendar className="w-3 h-3 text-white" />
                            {game.releaseDate ? new Date(game.releaseDate).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "TBA"}
                          </span>
                          
                          {game.purchaseLinks.length > 0 ? (
                            <a
                              href={game.purchaseLinks[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline text-white font-black uppercase"
                            >
                              <span>{game.purchaseLinks[0].storeName}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-white/40 uppercase">[ TBA link ]</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* TBA / Undated Games */}
            {tbaGames.length > 0 && (
              <section className="space-y-6">
                <h3 className="font-mono text-xs text-white border-b border-white pb-2 tracking-widest uppercase font-black">
                  // Date TBA
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tbaGames.map((game) => (
                    <div 
                      key={game.id}
                      className="border border-white bg-black p-5 flex gap-5 hover:bg-neutral-950/40 transition-all duration-150"
                    >
                      {/* Image Block */}
                      <div className="w-24 h-32 relative bg-neutral-900 border border-white shrink-0 flex items-center justify-center overflow-hidden">
                        {game.coverUrl ? (
                          <img
                            src={getHighResCoverUrl(game.coverUrl) || ""}
                            alt={game.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">No Cover</span>
                        )}
                      </div>

                      {/* Info Block */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-2">
                          <Link href={`/game/${game.slug}`} className="hover:underline">
                            <h4 className="text-sm font-bold uppercase text-white truncate max-w-[240px]">
                              {game.title}
                            </h4>
                          </Link>
                          <span className="font-mono text-[9px] text-white/60 block font-bold">
                            by {game.developers[0]?.name || "Unknown Developer"}
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {game.tags.slice(0, 2).map((t) => (
                              <span key={t.slug} className="font-mono text-[8px] border border-white/30 text-white/80 px-1.5 py-0.2 uppercase font-medium">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-white/20 pt-3 mt-3 flex items-center justify-between font-mono text-[9px]">
                          <span className="flex items-center gap-1 font-bold text-white uppercase">
                            <Calendar className="w-3 h-3 text-white" />
                            TBA
                          </span>
                          
                          {game.purchaseLinks.length > 0 ? (
                            <a
                              href={game.purchaseLinks[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline text-white font-black uppercase"
                            >
                              <span>{game.purchaseLinks[0].storeName}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-white/40 uppercase">[ TBA link ]</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
