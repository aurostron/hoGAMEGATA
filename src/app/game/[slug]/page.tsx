import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Calendar, Star, Compass, Tag, Monitor, Clock, Shield } from "lucide-react";
import { db } from "@/lib/db";
import AuthButton from "@/components/AuthButton";
import TrackControls from "@/components/TrackControls";
import { getServerUser } from "@/lib/serverAuth";

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Enable ISR: Revalidate pages at most once every hour
export const revalidate = 3600;

// Pre-render game profiles at build time
export async function generateStaticParams() {
  try {
    const games = await db.game.findMany({
      select: { slug: true },
    });
    return games.map((game) => ({
      slug: game.slug,
    }));
  } catch (error) {
    console.error("⚠️ generateStaticParams failed:", error);
    return [];
  }
}
const getCategoryBadge = (category: number | null): string | null => {
  if (category === 1) return "DLC";
  if (category === 2) return "Expansion";
  if (category === 4) return "Standalone";
  if (category === 8) return "Remake";
  if (category === 9) return "Remaster";
  return null;
};

function cleanRequirementsText(text: string): string {
  return text
    .replace(/^(Minimum|Recommended|Minimum Requirements|Recommended Requirements):\s*/i, "")
    .trim();
}

async function lazyEnrichRawgMetadata(game: any) {
  // If already enriched, return cached system requirements immediately
  if (game.rawgEnriched) {
    return { min: game.minRequirements, rec: game.recRequirements };
  }

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    return { min: game.minRequirements, rec: game.recRequirements };
  }

  const rawgSlug = game.rawgSlug || game.slug;
  try {
    let data = null;
    const url = `https://api.rawg.io/api/games/${rawgSlug}?key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      data = await response.json();
    } else {
      // Try title search fallback
      const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(game.title)}&page_size=1`;
      const searchRes = await fetch(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const bestMatch = searchData.results?.[0];
        if (bestMatch) {
          const detailUrl = `https://api.rawg.io/api/games/${bestMatch.id}?key=${apiKey}`;
          const detailRes = await fetch(detailUrl);
          if (detailRes.ok) {
            data = await detailRes.json();
          }
        }
      }
    }

    if (data) {
      const pcPlatform = data.platforms?.find((p: any) => p.platform?.slug === "pc");
      const requirements = pcPlatform?.requirements_en || null;
      const minRequirements = requirements?.minimum || null;
      const recRequirements = requirements?.recommended || null;
      const esrbRating = data.esrb_rating?.name || null;

      // Update local memory reference
      game.rawgEnriched = true;
      game.rawgId = data.id || null;
      game.metacritic = data.metacritic || null;
      game.metacriticUrl = data.metacritic_url || null;
      game.playtime = data.playtime || null;
      game.esrbRating = esrbRating;
      game.redditUrl = data.reddit_url || null;
      game.websiteUrl = data.website || null;
      game.rawgRating = data.rating || null;
      game.rawgSlug = data.slug || null;
      game.minRequirements = minRequirements;
      game.recRequirements = recRequirements;
      game.lastRawgSync = new Date();

      // Cache the complete metadata in the database asynchronously
      try {
        await db.game.update({
          where: { id: game.id },
          data: {
            rawgEnriched: true,
            rawgId: game.rawgId,
            metacritic: game.metacritic,
            metacriticUrl: game.metacriticUrl,
            playtime: game.playtime,
            esrbRating: game.esrbRating,
            redditUrl: game.redditUrl,
            websiteUrl: game.websiteUrl,
            rawgRating: game.rawgRating,
            rawgSlug: game.rawgSlug,
            minRequirements: game.minRequirements,
            recRequirements: game.recRequirements,
            lastRawgSync: game.lastRawgSync
          }
        });
        console.log(`💾 RAWG metadata lazy-enriched and cached for game ID: ${game.id}`);
      } catch (dbErr) {
        console.error("Failed to save lazy-enriched RAWG metadata to DB:", dbErr);
      }

      return { min: minRequirements, rec: recRequirements };
    }
  } catch (error) {
    console.error(`⚠️ Failed to lazy-load RAWG metadata for ${game.title}:`, error);
  }

  return { min: game.minRequirements, rec: game.recRequirements };
}
export default async function GameProfilePage({ params }: GamePageProps) {
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  // Query game details from database
  const game = await db.game.findUnique({
    where: { slug },
    include: {
      developers: true,
      publishers: true,
      genres: true,
      platforms: true,
      purchaseLinks: true,
    },
  });

  if (!game) {
    notFound();
  }

  // Lazy enrich RAWG metadata on server side
  const requirements = await lazyEnrichRawgMetadata(game);

  // Format rating display
  const ratingDisplay = game.rating ? `${game.rating.toFixed(1)} / 100` : "No rating yet";

  // Fetch the user's wishlist and collection tracking state on the server
  const user = await getServerUser();
  let isWishlisted = false;
  let collectionStatus = null;

  if (user) {
    const wishlistRecord = await db.wishlist.findUnique({
      where: {
        userId_gameId: {
          userId: user.id,
          gameId: game.id,
        },
      },
    });
    isWishlisted = !!wishlistRecord;

    const collectionRecord = await db.collection.findUnique({
      where: {
        userId_gameId: {
          userId: user.id,
          gameId: game.id,
        },
      },
    });
    collectionStatus = collectionRecord ? collectionRecord.status : null;
  }

  // Query related games (matching current game's genres or developers, excluding current game)
  let relatedGames = await db.game.findMany({
    where: {
      id: { not: game.id },
      OR: [
        {
          genres: {
            some: {
              id: { in: game.genres.map((g) => g.id) },
            },
          },
        },
        {
          developers: {
            some: {
              id: { in: game.developers.map((d) => d.id) },
            },
          },
        },
      ],
    },
    take: 4,
    orderBy: [
      { rating: "desc" },
      { releaseDate: "desc" },
    ],
    include: {
      developers: true,
      genres: true,
      platforms: true,
    },
  });

  // Fallback to highest rated if no related games found
  if (relatedGames.length === 0) {
    relatedGames = await db.game.findMany({
      where: {
        id: { not: game.id },
      },
      take: 4,
      orderBy: [
        { rating: "desc" },
        { releaseDate: "desc" },
      ],
      include: {
        developers: true,
        genres: true,
        platforms: true,
      },
    });
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      {/* Top Sticky Header */}
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link href="/" className="hover:opacity-85">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                <span className="italic">ho</span>GAMEGATA.
              </h1>
            </Link>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-white uppercase font-bold">
              <span>[Horror]</span>
              <span className="text-white font-black">•</span>
              <span>Game</span>
              <span className="text-white font-black">•</span>
              <span>Mega</span>
              <span className="text-white font-black">•</span>
              <span>Metadata</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthButton />
            <Link 
              href="/" 
              className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
            >
              
              <span>[ Return to Search ]</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Left Column: Cover & Quick Stats */}
          <div className="md:col-span-1 space-y-6">
            <div className="border border-white bg-black p-1 rounded-none overflow-hidden shrink-0 relative">
              {game.coverUrl ? (
                <img 
                  src={game.coverUrl} 
                  alt={game.title} 
                  className="w-full h-auto object-cover border border-white"
                />
              ) : (
                <div className="aspect-[3/4] w-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center border border-white">
                  <span className="font-mono text-xs uppercase tracking-widest text-white">No Cover Art</span>
                </div>
              )}
              {/* Category Tag */}
              {getCategoryBadge(game.category) && (
                <span className="absolute top-3 left-3 font-mono text-[8px] uppercase tracking-widest bg-[#7f1d1d] text-[#fca5a5] border border-[#fca5a5] font-black px-1.5 py-0.5 z-10">
                  {getCategoryBadge(game.category)}
                </span>
              )}
            </div>

            {/* Quick Specs Container */}
            <div className="border border-white bg-black p-5 space-y-4 font-mono text-xs font-bold uppercase">
              <span className="font-mono text-[9px] text-white/50 tracking-widest block border-b border-white/20 pb-1">Quick Specs</span>
              
              <div className="flex justify-between items-center">
                <span className="text-white flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Release:</span>
                <span className="text-white font-black">
                  {game.releaseDate ? new Date(game.releaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "N/A"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Rating:</span>
                <span className="text-white font-black">{ratingDisplay}</span>
              </div>

              <div className="flex justify-between items-start gap-4">
                <span className="text-white flex items-center gap-1.5 shrink-0"><Monitor className="w-3.5 h-3.5" /> Systems:</span>
                <span className="text-white font-black text-right line-clamp-2">
                  {game.platforms.map(p => p.name).join(", ")}
                </span>
              </div>

              {game.playtime !== null && game.playtime > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-white flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Playtime:</span>
                  <span className="text-white font-black">{game.playtime} hrs</span>
                </div>
              )}

              {game.esrbRating && (
                <div className="flex justify-between items-center">
                  <span className="text-white flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> ESRB:</span>
                  <span className="text-white font-black">{game.esrbRating}</span>
                </div>
              )}

              {game.metacritic !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-white flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Metacritic:</span>
                  {game.metacriticUrl ? (
                    <a 
                      href={game.metacriticUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline font-black flex items-center gap-1 group/meta"
                    >
                      <span>{game.metacritic} / 100</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-65 group-hover/meta:opacity-100" />
                    </a>
                  ) : (
                    <span className="text-white font-black">{game.metacritic} / 100</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Descriptions & Details */}
          <div className="md:col-span-2 space-y-8">
            <div className="space-y-4">
              <span className="font-mono text-[9px] text-white uppercase tracking-widest border border-white px-2 py-0.5 font-bold bg-white text-black w-fit block">
                {game.status}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-tight">
                {game.title}
              </h2>
              <div className="flex flex-wrap gap-2 text-xs font-mono font-bold uppercase">
                <span className="text-white/60">Developed by:</span>
                <span className="text-white font-black">{game.developers.map(d => d.name).join(", ")}</span>
                {game.publishers.length > 0 && (
                  <>
                    <span className="text-white/60 ml-2">Published by:</span>
                    <span className="text-white font-black">{game.publishers.map(p => p.name).join(", ")}</span>
                  </>
                )}
              </div>
            </div>

            {/* User registry control tools */}
            <TrackControls
              gameId={game.id}
              gameSlug={game.slug}
              initialWishlisted={isWishlisted}
              initialCollectionStatus={collectionStatus}
            />

            {/* Description Paragraph */}
            <div className="border-t border-white pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-white" />
                <span className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Description & Overview</span>
              </div>
              <p className="text-sm text-white font-medium leading-relaxed font-sans">
                {game.summary || "No overview available for this title."}
              </p>
              {game.storyline && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest block mb-2 font-bold">Storyline</span>
                  <p className="text-xs text-white leading-relaxed font-sans font-medium">
                    {game.storyline}
                  </p>
                </div>
              )}
            </div>

            {/* Genre & Tag badging */}
            <div className="border-t border-white pt-6 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-white uppercase tracking-widest font-black">
                <Tag className="w-3.5 h-3.5" /> Genres:
              </div>
              <div className="flex flex-wrap gap-2">
                {game.genres.map(genre => (
                  <span key={genre.slug} className="border border-white text-white font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 font-bold">
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Outlinks & Documentation */}
            {(game.purchaseLinks.length > 0 || game.websiteUrl || game.redditUrl || game.rawgSlug) && (
              <div className="border-t border-white pt-6 space-y-4">
                <span className="font-mono text-[10px] text-white uppercase tracking-widest font-black block">Buy the game</span>
                <div className="flex flex-wrap gap-3">
                  {/* Purchase/Store Outlinks */}
                  {game.purchaseLinks.map(link => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 font-mono text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-2 font-bold"
                    >
                      <ExternalLink className="w-3 h-3 text-white group-hover:text-black" />
                      <span>Support Creator ({link.storeName})</span>
                    </a>
                  ))}

                  {/* Official Website */}
                  {game.websiteUrl && (
                    <a
                      href={game.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 font-mono text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-2 font-bold"
                    >
                      <ExternalLink className="w-3 h-3 text-white group-hover:text-black" />
                      <span>Official Website</span>
                    </a>
                  )}

                  {/* Reddit Community */}
                  {game.redditUrl && (
                    <a
                      href={game.redditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 font-mono text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-2 font-bold"
                    >
                      <ExternalLink className="w-3 h-3 text-white group-hover:text-black" />
                      <span>Reddit Community</span>
                    </a>
                  )}

                  {/* RAWG Profile Attribution Link */}
                  {game.rawgSlug && (
                    <a
                      href={`https://rawg.io/games/${game.rawgSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 font-mono text-[10px] text-white/70 hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white/50 hover:border-white px-3 py-2 font-bold"
                    >
                      <ExternalLink className="w-3 h-3 text-white/70 group-hover:text-black" />
                      <span>RAWG Profile</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Screenshots Gallery (If available) */}
        {game.screenshots.length > 0 && (
          <section className="border-t border-white pt-12 space-y-6">
            <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Screenshots Spec</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {game.screenshots.map((url, i) => (
                <div key={i} className="border border-white bg-black p-1 hover:bg-white transition-colors duration-150">
                  <img
                    src={url}
                    alt={`${game.title} screenshot ${i + 1}`}
                    className="w-full h-auto object-cover border border-white hover:opacity-95 transition-opacity"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Embedded Trailer Video (If available) */}
        {game.trailerUrl && (
          <section className="border-t border-white pt-12 space-y-6">
            <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Game trailers and videos</h3>
            <div className="border border-white bg-black p-1 aspect-video w-full max-w-3xl mx-auto">
              <iframe
                src={game.trailerUrl}
                title={`${game.title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border border-white"
              ></iframe>
            </div>
          </section>
        )}

        {/* PC System Requirements */}
        {(requirements.min || requirements.rec) && (
          <section className="border-t border-white pt-12 space-y-6">
            <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black font-bold">PC System Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {requirements.min && (
                <div className="border border-white/20 bg-neutral-950 p-6 space-y-3 rounded-none">
                  <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest block font-bold">Minimum Requirements</span>
                  <div className="text-xs text-white/80 leading-relaxed whitespace-pre-line font-medium font-sans">
                    {cleanRequirementsText(requirements.min)}
                  </div>
                </div>
              )}
              {requirements.rec && (
                <div className="border border-white/20 bg-neutral-950 p-6 space-y-3 rounded-none">
                  <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest block font-bold">Recommended Requirements</span>
                  <div className="text-xs text-white/80 leading-relaxed whitespace-pre-line font-medium font-sans">
                    {cleanRequirementsText(requirements.rec)}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Similar Games Section */}
        {relatedGames.length > 0 && (
          <section className="border-t border-white pt-12 space-y-6">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-white" />
              <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Related Specifications</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {relatedGames.map((relatedGame) => (
                <Link
                  key={relatedGame.slug}
                  href={`/game/${relatedGame.slug}`}
                  className="border border-white bg-black rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full"
                >
                  {/* Cover Image */}
                  <div className="h-48 bg-black relative border-b border-white overflow-hidden shrink-0 flex items-center justify-center">
                    {relatedGame.coverUrl ? (
                      <img
                        src={relatedGame.coverUrl}
                        alt={relatedGame.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-white">No Cover</span>
                      </div>
                    )}
                    {/* Primary Genre Tag */}
                    <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                      {relatedGame.genres[0]?.name || "Horror"}
                    </span>
                  </div>

                  {/* Game Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-white group-hover:text-black text-sm font-bold tracking-wide uppercase line-clamp-1">
                        {relatedGame.title}
                      </h4>
                      <span className="font-mono text-[9px] text-white group-hover:text-black block font-bold mt-1">
                        by {relatedGame.developers[0]?.name || "Unknown Dev"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/20 font-mono text-[9px]">
                      <span className="text-white group-hover:text-black font-bold truncate max-w-[120px]">
                        {relatedGame.platforms.map((p) => p.name).slice(0, 2).join(", ")}
                      </span>
                      <span className="px-1.5 py-0.2 border border-white text-white group-hover:text-black group-hover:border-black font-bold">
                        {relatedGame.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
