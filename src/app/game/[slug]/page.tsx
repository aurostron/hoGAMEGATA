import { notFound } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Calendar, Star, Compass, Tag, Monitor, Clock, Shield, Flame } from "lucide-react";
import { db } from "@/lib/db";
import TrackControls from "@/components/TrackControls";
import VibeTracker from "@/components/VibeTracker";

import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle } from "@/lib/utils";
import SciFiLogo from "@/components/SciFiLogo";
import PlatformLogos from "@/components/PlatformLogos";
import SettingsButton from "@/components/SettingsButton";
import HeaderSearch from "@/components/HeaderSearch";
import dynamic from "next/dynamic";
import ScareMeter from "@/components/ScareMeter";

const PriceComparison = dynamic(() => import("@/components/PriceComparison"));
const ScreenshotGallery = dynamic(() => import("@/components/ScreenshotGallery"));
const CreatorGames = dynamic(() => import("@/components/CreatorGames"));

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    country?: string;
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
      orderBy: { popularity: "desc" },
      take: 100,
    });
    return games.map((game) => ({
      slug: game.slug,
    }));
  } catch (error) {
    console.error("⚠️ generateStaticParams failed:", error);
    return [];
  }
}

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

async function lazyEnrichProtonDbMetadata(game: any) {
  // If the game has already been synced within the last 7 days, return immediately
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (
    game.protonDbTier !== null && 
    game.lastProtonDbSync && 
    game.lastProtonDbSync > sevenDaysAgo
  ) {
    return;
  }

  // Bypass requests during Next.js build phase
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
    const url = `https://www.protondb.com/api/v1/reports/summaries/${steamAppId}.json`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 hoGAMEGATA/1.0"
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Update local memory reference
      game.protonDbTier = data.tier || null;
      game.protonDbConfidence = data.confidence || null;
      game.protonDbScore = data.score !== undefined ? data.score : null;
      game.protonDbTotalReports = data.total !== undefined ? data.total : null;
      game.lastProtonDbSync = new Date();

      // Update database asynchronously
      try {
        await db.game.update({
          where: { id: game.id },
          data: {
            protonDbTier: game.protonDbTier,
            protonDbConfidence: game.protonDbConfidence,
            protonDbScore: game.protonDbScore,
            protonDbTotalReports: game.protonDbTotalReports,
            lastProtonDbSync: game.lastProtonDbSync
          }
        });
        console.log(`💾 ProtonDB metadata lazy-enriched and cached for game ID: ${game.id}`);
      } catch (dbErr) {
        console.error("Failed to save lazy-enriched ProtonDB metadata to DB:", dbErr);
      }
    } else if (response.status === 404) {
      // Game not found on ProtonDB (e.g. unreviewed or not a Steam game)
      game.protonDbTier = "unknown";
      game.lastProtonDbSync = new Date();
      try {
        await db.game.update({
          where: { id: game.id },
          data: {
            protonDbTier: "unknown",
            lastProtonDbSync: game.lastProtonDbSync
          }
        });
        console.log(`💾 Cached unknown ProtonDB status for game ID: ${game.id}`);
      } catch (dbErr) {
        console.error("Failed to cache unknown ProtonDB status to DB:", dbErr);
      }
    }
  } catch (error) {
    console.error(`⚠️ Failed to lazy-load ProtonDB reviews for ${game.title}:`, error);
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

  // Extract Steam AppID if available
  const steamLink = game.purchaseLinks?.find((link: any) => 
    link.storeName.toLowerCase() === "steam" || link.url.includes("steampowered.com")
  );
  const steamAppId = steamLink?.url.match(/\/app\/(\d+)/)?.[1] || null;



  // Retrieve cached system requirements from the database object
  const requirements = { min: game.minRequirements, rec: game.recRequirements };

  // Schedule RAWG and Steam metadata lazy enrichment in the background (Non-blocking Stale-While-Revalidate)
  after(async () => {
    const gameClone = { ...game };
    if (process.env.NODE_ENV === "development") {
      lazyEnrichProtonDbMetadata(gameClone);
      return; // Skip background API queries to RAWG and Steam in dev mode to prevent blocking the local socket
    }
    try {
      await Promise.all([
        lazyEnrichRawgMetadata(gameClone),
        lazyEnrichSteamMetadata(gameClone),
        lazyEnrichProtonDbMetadata(gameClone)
      ]);
    } catch (err) {
      console.error(`⚠️ Background enrichment failed for game ${game.title}:`, err);
    }
  });

  // Format rating display
  const ratingDisplay = game.rating ? `${(game.rating / 10).toFixed(1)} / 10` : "No rating yet";




  const isItchGame = game.slug.startsWith("itch-");

  const descriptionSection = (
    <div className="pt-6 space-y-4 select-none">
      <span className="font-mono text-xs text-white uppercase tracking-widest font-black block">Description & Overview</span>
      {game.summary ? (
        <div 
          className="text-sm text-white font-medium leading-relaxed font-sans prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: game.summary }}
        />
      ) : (
        <p className="text-sm text-white font-medium leading-relaxed font-sans">
          No overview available for this title.
        </p>
      )}
      {game.storyline && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest block mb-2 font-bold">Storyline</span>
          <p className="text-xs text-white leading-relaxed font-sans font-medium">
            {game.storyline}
          </p>
        </div>
      )}
    </div>
  );

  const moodSection = game.tags && game.tags.length > 0 && (
    <div className="pt-6 flex flex-wrap gap-4 items-center">
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
  );

  const scareSection = game.scareRating !== null && game.scareProfile && (
    <div className="pt-6">
      <ScareMeter 
        scareRating={game.scareRating} 
        scareProfile={game.scareProfile as any} 
        reviewCount={game.scareReviewCount}
      />
    </div>
  );

  const priceSection = (
    <PriceComparison
      gameId={game.id}
      gameSlug={game.slug}
      gameTitle={game.title}
      purchaseLinks={game.purchaseLinks}
    />
  );

  const linksSection = (game.purchaseLinks.length > 0 || game.websiteUrl || game.redditUrl || game.rawgSlug) && (
    <div className="pt-6 space-y-4">
      <span className="font-mono text-xs text-white uppercase tracking-widest font-black block">Official & Creator Links</span>
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
  );

  const detailsContent = isItchGame ? (
    <>
      {moodSection}
      {priceSection}
      {linksSection}
      {descriptionSection}
      {scareSection}
    </>
  ) : (
    <>
      {descriptionSection}
      {moodSection}
      {scareSection}
      {priceSection}
      {linksSection}
    </>
  );

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
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-end relative">
            <HeaderSearch />
            <SettingsButton />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Left Column: Cover & Quick Stats */}
          <div className="md:col-span-1 space-y-6">
            <div className={`border border-white bg-black p-1 rounded-none overflow-hidden shrink-0 relative w-full ${
              game.slug.startsWith("itch-") ? "aspect-[5/4]" : "aspect-[3/4]"
            }`}>
              {game.coverUrl ? (
                <div className="relative w-full h-full">
                  <Image 
                    src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending) || ""} 
                    alt={game.title} 
                    fill
                    sizes="(max-width: 768px) 100vw, 340px"
                    priority={true}
                    className="object-cover border border-white"
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center border border-white">
                  <span className="font-mono text-xs uppercase tracking-widest text-white">No Cover Art</span>
                </div>
              )}
              {/* Category Tag (Excluding Visual Novels) */}
              {(() => {
                const badge = getCategoryBadge(game.category, game.title);
                if (!badge || badge === "Visual Novel") return null;
                return (
                  <span className="absolute top-3 left-3 font-mono text-[8px] uppercase tracking-widest border font-black px-1.5 py-0.5 z-10 bg-[#7f1d1d] text-[#fca5a5] border-[#fca5a5]">
                    {badge}
                  </span>
                );
              })()}
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

              {game.scareRating !== null && (
                <div className="flex justify-between items-center border-t border-white/20 pt-3 mt-1">
                  <span className="text-white flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> SCARE SCORE:</span>
                  <span className="text-white font-black text-right">
                    {game.scareRating} / 100
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center gap-4">
                <span className="text-white flex items-center gap-1.5 shrink-0"><Monitor className="w-3.5 h-3.5" /> Platforms:</span>
                <PlatformLogos platforms={game.platforms} className="flex flex-wrap justify-end gap-2" solid={true} />
              </div>

              {steamAppId && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-white flex items-center gap-1.5 shrink-0">
                    <Monitor className="w-3.5 h-3.5" /> Linux compatibility:
                  </span>
                  <div className="text-right">
                    {game.protonDbTier ? (
                      <a
                        href={`https://www.protondb.com/app/${steamAppId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-end gap-1"
                        title={
                          game.protonDbConfidence && game.protonDbTotalReports
                            ? `${game.protonDbConfidence} confidence rating based on ${game.protonDbTotalReports} report(s)`
                            : "View detailed Linux compatibility reports on ProtonDB"
                        }
                      >
                        <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 ${
                          game.protonDbTier === "native" || game.protonDbTier === "platinum"
                            ? "bg-emerald-500 text-black font-black"
                            : game.protonDbTier === "gold"
                            ? "bg-white text-black font-black"
                            : game.protonDbTier === "silver"
                            ? "border border-white text-white font-bold"
                            : game.protonDbTier === "bronze" || game.protonDbTier === "borked"
                            ? "border border-red-500 text-red-500 line-through font-bold"
                            : "border border-white/20 text-white/40 font-bold"
                        }`}>
                          {game.protonDbTier}
                        </span>
                        {game.protonDbTotalReports !== null && game.protonDbTotalReports > 0 && (
                          <span className="text-[9px] text-white/50 font-bold tracking-tight lowercase">
                            ({game.protonDbTotalReports} reports)
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="text-white/30 font-mono italic">[ Syncing ]</span>
                    )}
                  </div>
                </div>
              )}

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
              <div className="flex flex-wrap items-center gap-2">
                {game.status && game.status.trim() !== "" && (
                  <span className="font-mono text-[9px] text-white uppercase tracking-widest border border-white px-2 py-0.5 font-bold bg-white text-black w-fit block">
                    {game.status}
                  </span>
                )}
                {(() => {
                  const badge = getCategoryBadge(game.category, game.title);
                  if (!badge) return null;
                  const isVN = badge === "Visual Novel";
                  const borderClass = isVN ? "border-[#581c87]" : "border-[#7f1d1d]";
                  const bgClass = isVN ? "bg-[#581c87] text-[#f5d0fe]" : "bg-[#7f1d1d] text-[#fca5a5]";
                  return (
                    <span className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-0.5 font-bold w-fit block ${borderClass} ${bgClass}`}>
                      {badge}
                    </span>
                  );
                })()}
                {game.slug.startsWith("itch-") && (
                  <span className="font-mono text-[9px] text-black uppercase tracking-widest border border-[#fa5c5c] px-2 py-0.5 font-bold bg-[#fa5c5c] w-fit block">
                    itch.io
                  </span>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-tight">
                {cleanTitle(game.title)}
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
            />
            
            {/* Background Vibe Tracking */}
            <VibeTracker tags={game.tags} genres={game.genres} />

            {(() => {
               const isItchGame = game.slug.startsWith("itch-");

               const descriptionSection = (
                 <div className="pt-6 space-y-4 select-none">
                   <span className="font-mono text-xs text-white uppercase tracking-widest font-black block">Description & Overview</span>
                   {game.summary ? (
                     <div 
                       className="text-sm text-white font-medium leading-relaxed font-sans prose prose-invert max-w-none"
                       dangerouslySetInnerHTML={{ __html: game.summary }}
                     />
                   ) : (
                     <p className="text-sm text-white font-medium leading-relaxed font-sans">
                       No overview available for this title.
                     </p>
                   )}
                   {game.storyline && (
                     <div className="mt-4 pt-4 border-t border-white/20">
                       <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest block mb-2 font-bold">Storyline</span>
                       <p className="text-xs text-white leading-relaxed font-sans font-medium">
                         {game.storyline}
                       </p>
                     </div>
                   )}
                 </div>
               );

               const moodSection = game.tags && game.tags.length > 0 && (
                 <div className="pt-6 flex flex-wrap gap-4 items-center">
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
               );

               const scareSection = game.scareRating !== null && game.scareProfile && (
                 <div className="pt-6">
                   <ScareMeter 
                     scareRating={game.scareRating} 
                     scareProfile={game.scareProfile as any} 
                     reviewCount={game.scareReviewCount}
                   />
                 </div>
               );

               const priceSection = (
                 <PriceComparison
                   gameId={game.id}
                   gameSlug={game.slug}
                   gameTitle={game.title}
                   purchaseLinks={game.purchaseLinks}
                 />
               );

               const linksSection = (game.purchaseLinks.length > 0 || game.websiteUrl || game.redditUrl || game.rawgSlug) && (
                 <div className="pt-6 space-y-4">
                   <span className="font-mono text-xs text-white uppercase tracking-widest font-black block">Official & Creator Links</span>
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
               );

               const detailsContent = (
                 <>
                   {descriptionSection}
                   {moodSection}
                   {scareSection}
                   {priceSection}
                   {linksSection}
                 </>
               );

               if (isItchGame) {
                 return (
                   <>
                     {!isItchGame && detailsContent}
                   </>
                 );
               } else {
                 return (
                   <>
                     {detailsContent}
                   </>
                 );
               }
             })()}

          </div>
        </div>

        {game.slug.startsWith("itch-") && (
          <div className="space-y-8 mt-12">
            {/* Re-rendering details for Itch layout logic */}
            {(() => {
               const descriptionSection = (
                 <div className="pt-6 space-y-4 select-none">
                   <span className="font-mono text-xs text-white uppercase tracking-widest font-black block">Description & Overview</span>
                   {game.summary ? (
                     <div 
                       className="text-sm text-white font-medium leading-relaxed font-sans prose prose-invert max-w-none"
                       dangerouslySetInnerHTML={{ __html: game.summary }}
                     />
                   ) : (
                     <p className="text-sm text-white font-medium leading-relaxed font-sans">
                       No overview available for this title.
                     </p>
                   )}
                   {game.storyline && (
                     <div className="mt-4 pt-4 border-t border-white/20">
                       <span className="font-mono text-[9px] text-white/50 uppercase tracking-widest block mb-2 font-bold">Storyline</span>
                       <p className="text-xs text-white leading-relaxed font-sans font-medium">
                         {game.storyline}
                       </p>
                     </div>
                   )}
                 </div>
               );
               const moodSection = game.tags && game.tags.length > 0 && (
                 <div className="pt-6 flex flex-wrap gap-4 items-center">
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
               );
               const scareSection = game.scareRating !== null && game.scareProfile && (
                 <div className="pt-6">
                   <ScareMeter 
                     scareRating={game.scareRating} 
                     scareProfile={game.scareProfile as any} 
                     reviewCount={game.scareReviewCount}
                   />
                 </div>
               );
               const priceSection = (
                 <PriceComparison
                   gameId={game.id}
                   gameSlug={game.slug}
                   gameTitle={game.title}
                   purchaseLinks={game.purchaseLinks}
                 />
               );
               const linksSection = (game.purchaseLinks.length > 0 || game.websiteUrl || game.redditUrl || game.rawgSlug) && (
                 <div className="pt-6 space-y-4">
                   <span className="font-mono text-xs text-white uppercase tracking-widest font-black block">Official & Creator Links</span>
                   <div className="flex flex-wrap gap-3">
                     {game.purchaseLinks.map(link => (
                       <a key={link.id} href={`/re/${game.slug}/${link.storeName.toLowerCase().replace(/[^a-z0-9]/g, "")}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(link.url)}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 font-mono text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-2 font-bold">
                         <ExternalLink className="w-3 h-3 text-white group-hover:text-black" />
                         <span>Support Creator ({link.storeName})</span>
                       </a>
                     ))}
                     {game.websiteUrl && (
                       <a href={game.websiteUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 font-mono text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-2 font-bold">
                         <ExternalLink className="w-3 h-3 text-white group-hover:text-black" />
                         <span>Official Website</span>
                       </a>
                     )}
                     {game.redditUrl && (
                       <a href={game.redditUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 font-mono text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-2 font-bold">
                         <ExternalLink className="w-3 h-3 text-white group-hover:text-black" />
                         <span>Reddit Community</span>
                       </a>
                     )}
                     {game.rawgSlug && (
                       <a href={`https://rawg.io/games/${game.rawgSlug}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 font-mono text-[10px] text-white/70 hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white/50 hover:border-white px-3 py-2 font-bold">
                         <ExternalLink className="w-3 h-3 text-white/70 group-hover:text-black" />
                         <span>RAWG Profile</span>
                       </a>
                     )}
                   </div>
                 </div>
               );
               return (
                 <>
                   {moodSection}
                   {priceSection}
                   {linksSection}
                   {descriptionSection}
                   {scareSection}
                 </>
               );
            })()}
          </div>
        )}

        {/* Screenshots Gallery (If available) */}
        {game.screenshots.length > 0 && (
          <section className="border-t border-white pt-12 space-y-6">
            <h3 className="font-mono text-xs text-white uppercase tracking-widest font-black">Screenshots</h3>
            <ScreenshotGallery screenshots={game.screenshots.map(url => getCloudinaryFetchUrl(url, game.isTrending) || url)} title={game.title} />
          </section>
        )}

        {/* Embedded Trailer Video (If available) */}
        {game.trailerUrl && (
          <section className="border-t border-white pt-12 space-y-6">
            <h3 className="font-mono text-xs text-white uppercase tracking-widest font-black">Game trailers and videos</h3>
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
                <div className="border border-white bg-black p-6 space-y-4 rounded-none">
                  <span className="font-mono text-[9px] bg-white text-black px-2 py-0.5 uppercase tracking-widest inline-block font-black">Minimum Requirements</span>
                  <div className="text-xs text-white leading-relaxed font-mono space-y-2.5 pt-2">
                    {cleanRequirementsText(requirements.min).split("\n").map((line, idx) => {
                      const parts = line.split(/:(.*)/);
                      if (parts.length >= 2) {
                        return (
                          <div key={idx} className="flex flex-col sm:flex-row sm:justify-between border-b border-white/10 pb-1.5 gap-1">
                            <span className="text-white/60 font-bold tracking-wider uppercase text-[10px]">{parts[0].trim()}</span>
                            <span className="text-white font-black text-right">{parts[1].trim()}</span>
                          </div>
                        );
                      }
                      return <p key={idx} className="text-white font-medium pl-1">{line}</p>;
                    })}
                  </div>
                </div>
              )}
              {requirements.rec && (
                <div className="border border-white bg-black p-6 space-y-4 rounded-none">
                  <span className="font-mono text-[9px] bg-white text-black px-2 py-0.5 uppercase tracking-widest inline-block font-black">Recommended Requirements</span>
                  <div className="text-xs text-white leading-relaxed font-mono space-y-2.5 pt-2">
                    {cleanRequirementsText(requirements.rec).split("\n").map((line, idx) => {
                      const parts = line.split(/:(.*)/);
                      if (parts.length >= 2) {
                        return (
                          <div key={idx} className="flex flex-col sm:flex-row sm:justify-between border-b border-white/10 pb-1.5 gap-1">
                            <span className="text-white/60 font-bold tracking-wider uppercase text-[10px]">{parts[0].trim()}</span>
                            <span className="text-white font-black text-right">{parts[1].trim()}</span>
                          </div>
                        );
                      }
                      return <p key={idx} className="text-white font-medium pl-1">{line}</p>;
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Creator Games Section */}
        {game.developers.length > 0 ? (
          <CreatorGames 
            creatorIds={game.developers.map(d => d.id)}
            creatorNames={game.developers.map(d => d.name)}
            excludeGameId={game.id}
          />
        ) : game.publishers.length > 0 ? (
          <CreatorGames 
            creatorIds={game.publishers.map(p => p.id)}
            creatorNames={game.publishers.map(p => p.name)}
            excludeGameId={game.id}
          />
        ) : null}

      </main>
    </div>
  );
}
