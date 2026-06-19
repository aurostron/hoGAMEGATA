
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { Search, Calendar, Sparkles } from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle } from "@/lib/utils";
import PlatformLogos from "@/components/PlatformLogos";
import NyanLoader from "@/components/NyanLoader";

export interface GameData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  coverUrl: string | null;
  isTrending: boolean;
  rating: number | null;
  category: number | null;
  esrbRating: string | null;
  pegiRating: string | null;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  tags: Array<{ name: string; slug: string }>;
  priceSnapshots?: Array<{
    storeName: string;
    dealPrice: number;
    retailPrice: number;
    discountPercent: number;
    dealUrl: string;
    currency: string;
    country: string;
  }>;
}

const getShortEsrbRating = (rating: string | null): string | null => {
  if (!rating) return null;
  const lower = rating.toLowerCase();
  if (lower.includes("everyone 10")) return "E10+";
  if (lower.includes("everyone")) return "E";
  if (lower.includes("teen")) return "T";
  if (lower.includes("mature")) return "M";
  if (lower.includes("adult")) return "AO";
  if (lower.includes("pending")) return "RP";
  return rating.substring(0, 3).toUpperCase();
};

interface GameCardProps {
  game: GameData;
  index: number;
  activeRegion: string;
  findCheapestDeal: (game: GameData) => any;
  mobileLayout?: "grid" | "list";
}

function GameCard({ game, index, activeRegion, findCheapestDeal, mobileLayout = "grid" }: GameCardProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvedDeal, setResolvedDeal] = useState<any>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPrompt(true);
  };

  const handleMouseLeave = () => {
    setShowPrompt(false);
  };

  const triggerPriceFetch = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPrompt(false);

    // 1. First check if we already have it in the initial cached snapshots
    const preExistingDeal = findCheapestDeal(game);
    if (preExistingDeal) {
      setResolvedDeal(preExistingDeal);
      return;
    }

    // 2. Fetch dynamically if not cached in snapshots
    setLoading(true);
    try {
      const response = await fetch(`/api/games/${game.id}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: game.title,
          purchaseLinks: [], // Let backend resolve
          country: activeRegion
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.deals && data.deals.length > 0) {
          setResolvedDeal(data.deals[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch price on demand:", err);
    } finally {
      setLoading(false);
    }
  };

  const finalDeal = resolvedDeal || findCheapestDeal(game);
  const hasItchBadge = game.slug.startsWith("itch-");

  return (
    <Link 
      href={`/game/${game.slug}`}
      onContextMenu={handleContextMenu}
      onMouseLeave={handleMouseLeave}
      className={`border border-white bg-transparent rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex relative select-none ${
        mobileLayout === "list"
          ? "flex-row h-28 md:flex-col md:h-full"
          : "flex-col h-full"
      }`}
    >
      {/* Cover Image */}
      <div className={`relative bg-neutral-900 overflow-hidden shrink-0 flex items-center justify-center ${
        mobileLayout === "list"
          ? "w-24 border-r border-b-0 h-full md:w-full md:border-b md:border-r-0 md:h-auto " + (game.slug.startsWith("itch-") ? "md:aspect-[5/4]" : "md:aspect-[3/4]")
          : "w-full border-b border-white " + (game.slug.startsWith("itch-") ? "aspect-[5/4]" : "aspect-[3/4]")
      }`}>
        {game.coverUrl ? (
          <Image
            src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending) || ""}
            alt={game.title}
            fill={true}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading={index < 4 ? undefined : "lazy"}
            priority={index < 4}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white">No Cover</span>
          </div>
        )}
        {/* Category Tag */}
        {(() => {
          const badge = getCategoryBadge(game.category, game.title);
          if (!badge) return null;
          const isVN = badge === "Visual Novel";
          const bgClass = isVN ? "bg-[#581c87] text-[#f5d0fe] border-[#f5d0fe]" : "bg-[#7f1d1d] text-[#fca5a5] border-[#fca5a5]";
          return (
            <span className={`absolute top-2 left-2 font-mono text-[8px] uppercase tracking-widest border font-black px-1.5 py-0.5 z-10 ${
              mobileLayout === "list" ? "hidden md:inline-block" : ""
            } ${bgClass}`}>
              {badge}
            </span>
          );
        })()}
        {/* itch.io Badge */}
        {hasItchBadge && (
          <span className={`absolute top-2 right-2 font-mono text-[8px] uppercase tracking-widest bg-[#fa5c5c] text-black border border-[#fa5c5c] font-black px-1.5 py-0.5 z-10 ${
            mobileLayout === "list" ? "hidden md:inline-block" : ""
          }`}>
            itch.io
          </span>
        )}
        {/* Primary Mood Tag */}
        {game.tags && game.tags.length > 0 && (
          <span className={`absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5 ${
            mobileLayout === "list" ? "hidden md:inline-block" : ""
          }`}>
            {game.tags[0].name}
          </span>
        )}
        {/* Age Rating Badge */}
        {(game.esrbRating || game.pegiRating) && (
          <span className={`absolute bottom-2 right-2 font-mono text-[8px] uppercase bg-black text-white border border-white font-black px-1.5 py-0.5 z-10 select-none group-hover:bg-white group-hover:text-black group-hover:border-black transition-all duration-150 ${
            mobileLayout === "list" ? "hidden md:inline-block" : ""
          }`}>
            {game.esrbRating ? getShortEsrbRating(game.esrbRating) : game.pegiRating}
          </span>
        )}
        
        {/* Right-click Trigger Prompt */}
        {showPrompt && !loading && (
          <span 
            onClick={triggerPriceFetch}
            className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-3 z-30 cursor-pointer select-none"
          >
            <span className="font-mono text-[10px] text-emerald-400 font-extrabold uppercase px-2 py-1.5 border border-emerald-400 bg-black tracking-wide hover:bg-white hover:text-black transition-colors duration-150">
              [ GET CHEAPEST PRICE? ]
            </span>
          </span>
        )}

        {/* Loading Spinner / Fetch state */}
        {loading && (
          <span className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-3 z-30 select-none">
            <span className="font-mono text-[9px] text-white/50 animate-pulse">[ FETCHING... ]</span>
          </span>
        )}
      </div>
      
      {/* Game Details */}
      <div className={`flex-1 flex flex-col justify-between ${
        mobileLayout === "list" ? "p-3 md:p-4 space-y-2 md:space-y-3" : "p-4 space-y-3"
      }`}>
        <div className="flex justify-between items-stretch gap-3 min-h-[32px]">
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <h4 className="text-white group-hover:text-black text-sm font-bold tracking-wide uppercase line-clamp-1 leading-none">
              {cleanTitle(game.title)}
            </h4>
            <span className="font-mono text-[9px] text-white/60 group-hover:text-black/60 block font-bold mt-1 leading-none">
              by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
            </span>
          </div>

          {finalDeal && (() => {
            const formatPrice = (amount: number, currencyCode: string) => {
              try {
                return new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: currencyCode,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                }).format(amount);
              } catch (e) {
                return `$${amount}`;
              }
            };
            
            const storeKey = finalDeal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const dealUrl = `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(finalDeal.dealUrl)}`;
            
            return (
              <span 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(dealUrl, "_blank", "noopener,noreferrer");
                }}
                className="px-2 border border-emerald-400 bg-emerald-950 text-emerald-400 font-mono text-[11px] font-black uppercase tracking-wider flex items-center justify-center shrink-0 h-full select-none transition-all duration-150 group-hover:border-black group-hover:bg-emerald-500 group-hover:text-black hover:!bg-black hover:!text-emerald-400 hover:!border-emerald-400 cursor-pointer"
                title={`Get on ${finalDeal.storeName} (${formatPrice(finalDeal.dealPrice, finalDeal.currency)})`}
              >
                {formatPrice(finalDeal.dealPrice, finalDeal.currency)}
              </span>
            );
          })()}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/20 font-mono text-[9px]">
          <PlatformLogos platformNames={game.platformNames} />
          <span className="px-1.5 py-0.2 border border-white text-white group-hover:text-black group-hover:border-black font-bold">
            {game.status}
          </span>
        </div>
      </div>
    </Link>
  );
}

interface GameCatalogClientProps {
  initialGames: GameData[];
  initialTotalGames: number | null;
  initialNextCursor: string | null;
}

export default function GameCatalogClient({ initialGames, initialTotalGames, initialNextCursor }: GameCatalogClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const initialSearch = searchParams.get("search") || "";
  const initialTagsParam = searchParams.get("tags") || searchParams.get("tag") || "";
  const initialSort = (searchParams.get("sort") as "latest" | "trending" | "top-rated") || "latest";

  const [games, setGames] = useState<GameData[]>(initialGames);
  const [totalGames, setTotalGames] = useState<number | null>(initialTotalGames);
  const [loading, setLoading] = useState(false); // starts false because we have initial data
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [sortBy, setSortBy] = useState<"latest" | "trending" | "top-rated">(initialSort);
  const [hasInitialFetchRun, setHasInitialFetchRun] = useState(false);
  const [activeRegion, setActiveRegion] = useState("US");
  const [mobileLayout, setMobileLayout] = useState<"grid" | "list">("grid");
  const [sortOpen, setSortOpen] = useState(false);

  // Load layout setting from localStorage on mount and listen to changes
  useEffect(() => {
    const saved = localStorage.getItem("gata-mobile-layout");
    if (saved === "list" || saved === "grid") {
      setMobileLayout(saved);
    }

    const handleLayoutChange = () => {
      const currentSaved = localStorage.getItem("gata-mobile-layout");
      if (currentSaved === "list" || currentSaved === "grid") {
        setMobileLayout(currentSaved);
      }
    };

    window.addEventListener("gata-mobile-layout-changed", handleLayoutChange);
    return () => window.removeEventListener("gata-mobile-layout-changed", handleLayoutChange);
  }, []);

  const toggleMobileLayout = (layout: "grid" | "list") => {
    setMobileLayout(layout);
    localStorage.setItem("gata-mobile-layout", layout);
  };

  // Load and listen to persisted region setting
  useEffect(() => {
    const r = localStorage.getItem("gamegata_currency_region") || "US";
    setActiveRegion(r);
    
    const handleUpdate = () => {
      setActiveRegion(localStorage.getItem("gamegata_currency_region") || "US");
    };
    window.addEventListener("gamegata_currency_updated", handleUpdate);
    return () => window.removeEventListener("gamegata_currency_updated", handleUpdate);
  }, []);

  // Sync states with browser URL search parameters dynamically
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortBy && sortBy !== "latest") params.set("sort", sortBy);

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    const currentQuery = window.location.search;
    const expectedQuery = queryString ? `?${queryString}` : "";
    if (currentQuery !== expectedQuery) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [debouncedSearch, sortBy, pathname]);

  useEffect(() => {
    const query = searchParams.get("search") || "";
    const sort = (searchParams.get("sort") as "latest" | "trending") || "latest";
    setSearchQuery(query);
    setDebouncedSearch(query);
    setSortBy(sort);
  }, [searchParams]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    async function fetchInitialGames() {
      if (!hasInitialFetchRun && !debouncedSearch && sortBy === "latest") {
        setHasInitialFetchRun(true);
        return; // initial data is enough
      }
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.set("search", debouncedSearch);
        if (!debouncedSearch && sortBy) queryParams.set("sort", sortBy);
        queryParams.set("limit", "20");

        const response = await fetch(`/api/games?${queryParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setGames(data.games || []);
          setNextCursor(data.nextCursor || null);
          setTotalGames(data.totalCount ?? null);
        }
      } catch (err) {
        console.error("❌ Error fetching catalog:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialGames();
  }, [debouncedSearch, sortBy, hasInitialFetchRun]);

  async function loadMoreGames() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch) queryParams.set("search", debouncedSearch);
      if (!debouncedSearch && sortBy) queryParams.set("sort", sortBy);
      queryParams.set("cursor", nextCursor);
      queryParams.set("limit", "20");

      const response = await fetch(`/api/games?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setGames((prev) => {
          const incoming: GameData[] = data.games || [];
          const existingIds = new Set(prev.map((g) => g.id));
          const filteredIncoming = incoming.filter((g) => !existingIds.has(g.id));
          return [...prev, ...filteredIncoming];
        });
        setNextCursor(data.nextCursor || null);
      }
    } catch (err) {
      console.error("❌ Error fetching next page:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  const findCheapestDeal = (game: GameData) => {
    if (!game.priceSnapshots || game.priceSnapshots.length === 0) return null;
    
    // Filter by the current active region first
    let regional = game.priceSnapshots.filter(p => p.country === activeRegion);
    
    // Fallback to US if regional snaps aren't cached yet
    if (regional.length === 0) {
      regional = game.priceSnapshots.filter(p => p.country === "US");
    }
    if (regional.length === 0) {
      regional = game.priceSnapshots;
    }
    
    if (regional.length === 0) return null;
    
    // Sort ascending by price
    const sorted = [...regional].sort((a, b) => a.dealPrice - b.dealPrice);
    return sorted[0];
  };

  return (
    <>
      <section className="max-w-2xl mx-auto space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white/60" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, developer, genre, vibe..."
              className="block w-full pl-10 pr-4 py-3.5 bg-black border border-white/30 focus:border-white rounded-none focus:outline-none text-sm text-white placeholder-white/30 transition-all duration-200 font-medium tracking-wide"
            />
            {debouncedSearch && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors duration-150"
              >
                <span className="font-mono text-[10px] font-bold">[✕]</span>
              </button>
            )}
          </div>
        </section>

        {/* Catalog Mapping Grid */}
        <section className="space-y-6 relative">
          <div className="flex flex-col gap-3">
            {/* Top row: title + nav links */}
                    {/* Sorting and Mode Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-mono text-[10px] tracking-wider uppercase text-white font-bold border-b border-white/20 pb-4">
            {/* Left side: Sort by and Layout dropdowns adjacent to each other */}
            <div className="flex items-center gap-4 flex-wrap">
              {!debouncedSearch ? (
                <div className="relative">
                  <button
                    onClick={() => {
                      setSortOpen(!sortOpen);
                    }}
                    className="px-3 py-1.5 border border-white/30 text-white hover:border-white transition-all duration-150 rounded-none cursor-pointer flex items-center gap-1.5 uppercase font-bold"
                  >
                    SORT: {sortBy} <span className="text-[8px]">▼</span>
                  </button>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} />
                      <div className="absolute left-0 mt-1.5 w-32 bg-black border border-white z-40 flex flex-col divide-y divide-white/25">
                        <button
                          onClick={() => {
                            setSortBy("latest");
                            setSortOpen(false);
                          }}
                          className={`px-3 py-2 text-left hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer font-bold ${
                            sortBy === "latest" ? "bg-white/10 text-white" : "text-white"
                          }`}
                        >
                          [ LATEST ]
                        </button>
                        <button
                          onClick={() => {
                            setSortBy("trending");
                            setSortOpen(false);
                          }}
                          className={`px-3 py-2 text-left hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer font-bold ${
                            sortBy === "trending" ? "bg-white/10 text-white" : "text-white"
                          }`}
                        >
                          [ TRENDING ]
                        </button>
                        <button
                          onClick={() => {
                            setSortBy("top-rated");
                            setSortOpen(false);
                          }}
                          className={`px-3 py-2 text-left hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer font-bold ${
                            sortBy === "top-rated" ? "bg-white/10 text-white" : "text-white"
                          }`}
                        >
                          [ TOP RATED ]
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-white/55 font-medium py-1.5">
                  Search Results
                </div>
              )}

            </div>

            {/* Right side: Navigation links */}
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
              <Link
                href="/upcoming"
                className="flex items-center gap-1 border border-white/25 px-2.5 py-1.5 hover:border-white hover:bg-white hover:text-black transition-all duration-150"
              >
                <Calendar className="w-3 h-3" /> UPCOMING
              </Link>
              <Link
                href="/random"
                className="flex items-center gap-1 border border-white/25 px-2.5 py-1.5 hover:border-white hover:bg-white hover:text-black transition-all duration-150"
              >
                <Sparkles className="w-3 h-3" /> RANDOM
              </Link>
            </div>
          </div>  </div>

          {loading ? (
            <NyanLoader message="INGESTING CATALOG CONTENT..." />
          ) : games.length === 0 ? (
            /* No Results */
            <div className="text-center py-16 border border-white font-mono text-xs text-white uppercase tracking-widest font-bold">
              [ No horror titles match your current criteria ]
            </div>
          ) : (
            /* Game Grid */
            <div className="space-y-8">
              <div className={mobileLayout === "list" ? "flex flex-col gap-3 md:grid md:grid-cols-4 md:gap-4" : "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"}>
                {games.map((game, index) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    index={index}
                    activeRegion={activeRegion}
                    findCheapestDeal={findCheapestDeal}
                    mobileLayout={mobileLayout}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {nextCursor && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={loadMoreGames}
                    disabled={loadingMore}
                    className="font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-6 py-3 rounded-none font-bold disabled:opacity-50"
                  >
                    {loadingMore ? "[ Hang On... ]" : "[ Load More ]"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>



      
    </>
  );
}
