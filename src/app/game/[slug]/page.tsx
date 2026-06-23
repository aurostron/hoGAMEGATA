import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Calendar, Star, Compass, Tag, Monitor, Clock, Shield, Flame } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import TrackControls from "@/components/TrackControls";
import VibeTracker from "@/components/VibeTracker";

import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle } from "@/lib/utils";
import SciFiLogo from "@/components/SciFiLogo";
import PlatformLogos from "@/components/PlatformLogos";
import SettingsButton from "@/components/SettingsButton";
import HeaderSearch from "@/components/HeaderSearch";
import ShareButton from "@/components/ShareButton";
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

export const revalidate = 86400;

export async function generateStaticParams() {
  if (process.env.NODE_ENV === "development") {
    return [];
  }
  try {
    const supabase = getSupabaseServer();
    const { data: games } = await supabase
      .from("Game")
      .select("slug")
      .order("popularity", { ascending: false, nullsFirst: true })
      .limit(500);

    return (games || []).map((game) => ({
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
  if (game.rawgEnriched) {
    return { min: game.minRequirements, rec: game.recRequirements };
  }

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
      game.lastRawgSync = new Date().toISOString();

      const supabase = getSupabaseServer();
      try {
        await supabase
          .from("Game")
          .update({
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
            lastRawgSync: game.lastRawgSync,
          })
          .eq("id", game.id);
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
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (
    game.steamRating !== null && 
    game.lastSteamSync && 
    game.lastSteamSync > twentyFourHoursAgo
  ) {
    return;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const steamLink = game.purchaseLinks?.find((link: any) => 
    link.storeName.toLowerCase() === "steam" || link.url.includes("steampowered.com")
  );

  if (!steamLink) return;

  const match = steamLink.url.match(/\/app\/(\d+)/);
  const steamAppId = match ? match[1] : null;
  if (!steamAppId) return;

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

        game.steamRating = calculatedRating;
        game.steamRatingDesc = scoreDesc;
        game.lastSteamSync = new Date().toISOString();

        const supabase = getSupabaseServer();
        try {
          await supabase
            .from("Game")
            .update({
              steamRating: game.steamRating,
              steamRatingDesc: game.steamRatingDesc,
              lastSteamSync: game.lastSteamSync,
            })
            .eq("id", game.id);
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (
    game.protonDbTier !== null && 
    game.lastProtonDbSync && 
    game.lastProtonDbSync > sevenDaysAgo
  ) {
    return;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const steamLink = game.purchaseLinks?.find((link: any) => 
    link.storeName.toLowerCase() === "steam" || link.url.includes("steampowered.com")
  );

  if (!steamLink) return;

  const match = steamLink.url.match(/\/app\/(\d+)/);
  const steamAppId = match ? match[1] : null;
  if (!steamAppId) return;

  try {
    const url = `https://www.protondb.com/api/v1/reports/summaries/${steamAppId}.json`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 hoGAMEGATA/1.0"
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      game.protonDbTier = data.tier || null;
      game.protonDbConfidence = data.confidence || null;
      game.protonDbScore = data.score !== undefined ? data.score : null;
      game.protonDbTotalReports = data.total !== undefined ? data.total : null;
      game.lastProtonDbSync = new Date().toISOString();

      const supabase = getSupabaseServer();
      try {
        await supabase
          .from("Game")
          .update({
            protonDbTier: game.protonDbTier,
            protonDbConfidence: game.protonDbConfidence,
            protonDbScore: game.protonDbScore,
            protonDbTotalReports: game.protonDbTotalReports,
            lastProtonDbSync: game.lastProtonDbSync,
          })
          .eq("id", game.id);
        console.log(`💾 ProtonDB metadata lazy-enriched and cached for game ID: ${game.id}`);
      } catch (dbErr) {
        console.error("Failed to save lazy-enriched ProtonDB metadata to DB:", dbErr);
      }
    } else if (response.status === 404) {
      game.protonDbTier = "unknown";
      game.lastProtonDbSync = new Date().toISOString();
      const supabase = getSupabaseServer();
      try {
        await supabase
          .from("Game")
          .update({
            protonDbTier: "unknown",
            lastProtonDbSync: game.lastProtonDbSync,
          })
          .eq("id", game.id);
        console.log(`💾 Cached unknown ProtonDB status for game ID: ${game.id}`);
      } catch (dbErr) {
        console.error("Failed to cache unknown ProtonDB status:", dbErr);
      }
    }
  } catch (error) {
    console.error(`⚠️ Failed to load ProtonDB reviews for ${game.title}:`, error);
  }
}

export default async function GameProfilePage({ params }: GamePageProps) {
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  const supabase = getSupabaseServer();

  const { data: game } = await supabase
    .from("Game")
    .select(`
      *,
      developers:Developer(id, name, slug),
      publishers:Publisher(id, name, slug),
      genres:Genre(id, name, slug),
      tags:Tag(id, name, slug),
      platforms:Platform(id, name, slug),
      purchaseLinks:PurchaseLink(id, storeName, url)
    `)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (!game) {
    notFound();
  }

  // Redirect dry/unenriched itch.io games directly to their itch page (with purchase popup open)
  if (game.slug.startsWith("itch-") && !game.rawgEnriched) {
    const purchaseLinks = (game.purchaseLinks as any[]) || [];
    const itchLink = purchaseLinks.find(link => link.storeName.toLowerCase() === "itch.io");
    if (itchLink && itchLink.url) {
      const directPurchaseUrl = itchLink.url.endsWith("/purchase")
        ? itchLink.url
        : `${itchLink.url.replace(/\/$/, "")}/purchase`;
      redirect(directPurchaseUrl);
    }
  }

  // Extract Steam AppID if available
  const purchaseLinks = game.purchaseLinks as any[];
  const steamLink = purchaseLinks?.find((link: any) => 
    link.storeName.toLowerCase() === "steam" || link.url.includes("steampowered.com")
  );
  const steamAppId = steamLink?.url.match(/\/app\/(\d+)/)?.[1] || null;

  const requirements = { min: game.minRequirements, rec: game.recRequirements };

  // Schedule lazy enrichment in the background
  after(async () => {
    const gameClone = { ...game, purchaseLinks };
    if (process.env.NODE_ENV === "development") {
      lazyEnrichProtonDbMetadata(gameClone);
      return;
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

  const ratingDisplay = game.rating ? `${(game.rating / 10).toFixed(1)} / 10` : "No rating yet";

  const isItchGame = game.slug.startsWith("itch-");

  const tags = game.tags as any[];
  const developers = game.developers as any[];
  const publishers = game.publishers as any[];
  const genres = game.genres as any[];
  const platforms = game.platforms as any[];

  const descriptionSection = (
    <div className="pt-6 space-y-4 select-none">
      <h2 className="font-mono text-xs text-white uppercase tracking-widest font-black block">Description & Overview</h2>
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

  const moodSection = tags && tags.length > 0 && (
    <div className="pt-6 flex flex-wrap gap-4 items-center">
      <h2 className="flex items-center gap-1.5 font-mono text-[10px] text-white uppercase tracking-widest font-black">
        <Tag className="w-3.5 h-3.5" /> Mood/Genre
      </h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((t: any) => (
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
      purchaseLinks={purchaseLinks}
    />
  );

  const linksSection = (purchaseLinks?.length > 0 || game.websiteUrl || game.redditUrl || game.rawgSlug) && (
    <div className="pt-6 space-y-4">
      <h2 className="font-mono text-xs text-white uppercase tracking-widest font-black block">Official & Creator Links</h2>
      <div className="flex flex-wrap gap-3">
        {purchaseLinks?.map((link: any) => (
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

      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
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
                <PlatformLogos platforms={platforms} className="flex flex-wrap justify-end gap-2" solid={true} />
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

          <div className="md:col-span-2 flex flex-col justify-between md:h-full">
            <div className="space-y-4 mb-6">
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
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-tight">
                  {cleanTitle(game.title)}
                </h1>
                <ShareButton />
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono font-bold uppercase">
                <span className="text-white/60">Developed by:</span>
                <span className="text-white font-black">{developers.map((d: any) => d.name).join(", ")}</span>
                {publishers.length > 0 && (
                  <>
                    <span className="text-white/60 ml-2">Published by:</span>
                    <span className="text-white font-black">{publishers.map((p: any) => p.name).join(", ")}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex-grow flex flex-col justify-end gap-4">
              {(() => {
                const itchLink = purchaseLinks?.find((link: any) => link.storeName.toLowerCase() === "itch.io");
                if (itchLink && itchLink.url) {
                  const directPurchaseUrl = itchLink.url.endsWith("/purchase")
                    ? itchLink.url
                    : `${itchLink.url.replace(/\/$/, "")}/purchase`;
                  return (
                    <a
                      href={`/re/${game.slug}/itchio?gameId=${game.id}&fallbackUrl=${encodeURIComponent(directPurchaseUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[#fa5c5c] text-black font-mono text-xs uppercase tracking-widest font-black transition-all duration-150 hover:bg-[#ff7676] select-none rounded-none border border-[#fa5c5c]"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-black" />
                      <span>Buy / Download on itch.io</span>
                    </a>
                  );
                }
                return null;
              })()}
              <TrackControls
                gameId={game.id}
                gameSlug={game.slug}
                gameTitle={game.title}
                genres={genres.map((g: any) => g.name)}
                siteRating={game.rating ? game.rating / 10 : null}
                steamRating={game.steamRating}
              />
            </div>
          </div>
        </div>

        <div className="space-y-12 mt-12">
          <VibeTracker tags={tags} genres={genres} />
          {detailsContent}
        </div>

        {game.screenshots && game.screenshots.length > 0 && (
          <section className="border-t border-white pt-12 space-y-6">
            <h2 className="font-mono text-xs text-white uppercase tracking-widest font-black">Screenshots</h2>
            <ScreenshotGallery screenshots={game.screenshots.map((url: string) => getCloudinaryFetchUrl(url, game.isTrending) || url)} title={game.title} />
          </section>
        )}

        {game.trailerUrl && (
          <section className="border-t border-white pt-12 space-y-6">
            <h2 className="font-mono text-xs text-white uppercase tracking-widest font-black">Game trailers and videos</h2>
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

        {(requirements.min || requirements.rec) && (
          <section className="border-t border-white pt-12 space-y-6">
            <h2 className="font-mono text-[10px] text-white uppercase tracking-widest font-black font-bold">PC System Specifications</h2>
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

        {developers.length > 0 ? (
          <CreatorGames 
            creatorIds={developers.map((d: any) => d.id)}
            creatorNames={developers.map((d: any) => d.name)}
            excludeGameId={game.id}
          />
        ) : publishers.length > 0 ? (
          <CreatorGames 
            creatorIds={publishers.map((p: any) => p.id)}
            creatorNames={publishers.map((p: any) => p.name)}
            excludeGameId={game.id}
          />
        ) : null}

      </main>
    </div>
  );
}
