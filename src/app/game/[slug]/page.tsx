import { notFound } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Calendar, Star, Compass, Tag, Monitor, Clock, Shield } from "lucide-react";
import { db } from "@/lib/db";
import PriceComparison from "@/components/PriceComparison";
import AuthButton from "@/components/AuthButton";
import TrackControls from "@/components/TrackControls";
import { getServerUser } from "@/lib/serverAuth";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import { getHighResCoverUrl } from "@/lib/utils";
import SciFiLogo from "@/components/SciFiLogo";
import PlatformLogos from "@/components/PlatformLogos";
import ReturnButton from "@/components/ReturnButton";

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Enable ISR: Revalidate pages at most once every 24 hours
export const revalidate = 86400;

// Pre-render game profiles at build time
export async function generateStaticParams() {
  if (process.env.NODE_ENV === "development") {
    // Return empty array in development to prevent fetching 2,700+ rows on every dynamic route check
    return [];
  }
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

  // Bypass RAWG enrichment during Next.js build phase to prevent build-time network requests
  // and database connection exhaustion. Pages will be lazily enriched at runtime.
  if (process.env.NEXT_PHASE === "phase-production-build") {
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

async function lazyEnrichSteamMetadata(game: any) {
  // If the game has already been synced within the last 24 hours, return immediately
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (
    game.steamRating !== null && 
    game.lastSteamSync && 
    game.lastSteamSync > twentyFourHoursAgo
  ) {
    return;
  }

  // Bypass Steam API requests during Next.js build phase
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  // Find the Steam purchase link from purchaseLinks relation
  const steamLink = game.purchaseLinks?.find((link: any) => 
    link.storeName.toLowerCase() === "steam" || link.url.includes("steampowered.com")
  );

  if (!steamLink) {
    return;
  }

  // Extract Steam AppID using regex
  const match = steamLink.url.match(/\/app\/(\d+)/);
  const steamAppId = match ? match[1] : null;

  if (!steamAppId) {
    return;
  }

  try {
    const url = `https://store.steampowered.com/appreviews/${steamAppId}?json=1&num_per_page=0`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 hoGAMEGATA/1.0"
      }
    });

    if (response.ok) {
      const data = await response.json();
      const summary = data.query_summary;

      if (summary && summary.total_reviews > 0) {
        const totalReviews = summary.total_reviews;
        const totalPositive = summary.total_positive;
        const scoreDesc = summary.review_score_desc || "Mixed";
        const calculatedRating = (totalPositive / totalReviews) * 10;

        // Update local memory reference
        game.steamRating = calculatedRating;
        game.steamRatingDesc = scoreDesc;
        game.lastSteamSync = new Date();

        // Update database asynchronously
        try {
          await db.game.update({
            where: { id: game.id },
            data: {
              steamRating: game.steamRating,
              steamRatingDesc: game.steamRatingDesc,
              lastSteamSync: game.lastSteamSync
            }
          });
          console.log(`💾 Steam metadata lazy-enriched and cached for game ID: ${game.id}`);
        } catch (dbErr) {
          console.error("Failed to save lazy-enriched Steam metadata to DB:", dbErr);
        }
      }
    }
  } catch (error) {
    console.error(`⚠️ Failed to lazy-load Steam reviews for ${game.title}:`, error);
  }
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
      tags: true,
      platforms: true,
      purchaseLinks: true,
    },
  });

  if (!game) {
    notFound();
  }

  // Fetch user and related games concurrently
  const [user, relatedGamesResult] = await Promise.all([
    getServerUser(),
    db.game.findMany({
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
        tags: true,
        platforms: true,
      },
    })
  ]);

  let relatedGames = relatedGamesResult;

  // Retrieve cached system requirements from the database object
  const requirements = { min: game.minRequirements, rec: game.recRequirements };

  // Schedule RAWG and Steam metadata lazy enrichment in the background (Non-blocking Stale-While-Revalidate)
  after(async () => {
    try {
      // Create a fresh clone/copy of game properties needed for background functions to prevent mutation conflicts
      const gameClone = { ...game };
      await Promise.all([
        lazyEnrichRawgMetadata(gameClone),
        lazyEnrichSteamMetadata(gameClone)
      ]);
    } catch (err) {
      console.error(`⚠️ Background enrichment failed for game ${game.title}:`, err);
    }
  });

  // Format rating display
  const ratingDisplay = game.rating ? `${(game.rating / 10).toFixed(1)} / 10` : "No rating yet";

  let isWishlisted = false;
  let collectionStatus = null;

  if (user) {
    const [wishlistRecord, collectionRecord] = await Promise.all([
      db.wishlist.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId: game.id,
          },
        },
      }),
      db.collection.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId: game.id,
          },
        },
      })
    ]);
    isWishlisted = !!wishlistRecord;
    collectionStatus = collectionRecord ? collectionRecord.status : null;
  }

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
        tags: true,
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
            <SciFiLogo withLink={true} />
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
            <ReturnButton />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Left Column: Cover & Quick Stats */}
          <div className="md:col-span-1 space-y-6">
            <div className="border border-white bg-black p-1 rounded-none overflow-hidden shrink-0">
              {game.coverUrl ? (
                <Image 
                  src={getHighResCoverUrl(game.coverUrl) || ""} 
                  alt={game.title} 
                  width={340}
                  height={453}
                  priority={true}
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
                <span className="text-white flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Avg. Rating:</span>
                <span className="text-white font-black">{ratingDisplay}</span>
              </div>

              {game.steamRating !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-white flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> [STEAM]</span>
                  <span className="text-white font-black text-right">
                    {game.steamRating.toFixed(1)}/10 <span className="text-white/50 text-[10px] font-bold">[{game.steamRatingDesc}]</span>
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center gap-4">
                <span className="text-white flex items-center gap-1.5 shrink-0"><Monitor className="w-3.5 h-3.5" /> Platforms:</span>
                <PlatformLogos platforms={game.platforms} className="flex flex-wrap justify-end gap-2" solid={true} />
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

            {/* Mood Profile tag badging */}
            {game.tags && game.tags.length > 0 && (
              <div className="border-t border-white pt-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-white uppercase tracking-widest font-black">
                  <Tag className="w-3.5 h-3.5" /> Mood/Genre
                </div>
                <div className="flex flex-wrap gap-2">
                  {game.tags.map(t => (
                    <span key={t.slug} className="bg-white text-black font-mono text-[9px] uppercase tracking-wider px-2.5 py-0.5 font-bold border border-white">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Genre badging */}
            <div className="border-t border-white pt-6 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/60 uppercase tracking-widest font-bold">
                Genres:
              </div>
              <div className="flex flex-wrap gap-2">
                {game.genres.map(genre => (
                  <span key={genre.slug} className="border border-white/40 text-white/70 font-mono text-[9px] uppercase tracking-wider px-2 py-0.5">
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Cheapest Deals Comparison Engine (Client-Side Asynchronous Load) */}
            <PriceComparison
              gameId={game.id}
              gameSlug={game.slug}
              gameTitle={game.title}
              purchaseLinks={game.purchaseLinks}
            />

            {/* Outlinks & Documentation */}
            {(game.purchaseLinks.length > 0 || game.websiteUrl || game.redditUrl || game.rawgSlug) && (
              <div className="border-t border-white pt-6 space-y-4">
                <span className="font-mono text-[10px] text-white uppercase tracking-widest font-black block">Official & Creator Links</span>
                <div className="flex flex-wrap gap-3">
                  {/* Purchase/Store Outlinks */}
                  {game.purchaseLinks.map(link => (
                    <a
                      key={link.id}
                      href={`/re/${game.slug}/${link.storeName.toLowerCase().replace(/[^a-z0-9]/g, "")}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(link.url)}`}
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
            <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Screenshots</h3>
            <ScreenshotGallery screenshots={game.screenshots} title={game.title} />
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
              <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">More game like this</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {relatedGames.map((relatedGame) => (
                <Link
                  key={relatedGame.slug}
                  href={`/game/${relatedGame.slug}`}
                  className="border border-white bg-black rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full"
                >
                  {/* Cover Image */}
                  <div className="aspect-[3/4] relative w-full bg-neutral-900 border-b border-white overflow-hidden shrink-0 flex items-center justify-center">
                    {relatedGame.coverUrl ? (
                       <Image
                         src={getHighResCoverUrl(relatedGame.coverUrl) || ""}
                         alt={relatedGame.title}
                         fill={true}
                         sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                         className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                         loading="lazy"
                       />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-white">No Cover</span>
                      </div>
                    )}
                    {/* Primary Mood Tag */}
                    {relatedGame.tags && relatedGame.tags.length > 0 ? (
                      <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                        {relatedGame.tags[0].name}
                      </span>
                    ) : (
                      <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                        {relatedGame.genres[0]?.name || "Horror"}
                      </span>
                    )}
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
                      <PlatformLogos platforms={relatedGame.platforms} />
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
