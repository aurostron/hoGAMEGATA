
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { Search, Calendar, Sparkles } from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle } from "@/lib/utils";
import { usePreferences } from "@/hooks/usePreferences";
import PlatformLogos from "@/components/PlatformLogos";

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
  const initialSort = (searchParams.get("sort") as "latest" | "trending") || "latest";

  const [games, setGames] = useState<GameData[]>(initialGames);
  const [totalGames, setTotalGames] = useState<number | null>(initialTotalGames);
  const [loading, setLoading] = useState(false); // starts false because we have initial data
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [sortBy, setSortBy] = useState<"latest" | "trending">(initialSort);
  const [hasInitialFetchRun, setHasInitialFetchRun] = useState(false);

  const { vibes: explicitVibes, isLoaded: prefsLoaded } = usePreferences();

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
      if (!hasInitialFetchRun && !debouncedSearch && (!explicitVibes || explicitVibes.length === 0) && sortBy === "latest") {
        setHasInitialFetchRun(true);
        return; // initial data is enough
      }
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.set("search", debouncedSearch);
        if (!debouncedSearch && explicitVibes && explicitVibes.length > 0) queryParams.set("tags", explicitVibes.join(","));
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
  }, [debouncedSearch, explicitVibes, sortBy, hasInitialFetchRun]);

  async function loadMoreGames() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch) queryParams.set("search", debouncedSearch);
      if (!debouncedSearch && explicitVibes && explicitVibes.length > 0) queryParams.set("tags", explicitVibes.join(","));
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
        <section className="space-y-6">
          <div className="flex flex-col gap-3">
            {/* Top row: title + nav links */}
            {/* Personalization signal */}
            {prefsLoaded && explicitVibes.length > 0 && !debouncedSearch && (
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest flex-wrap">
                <span className="text-white/55">Showing results for:</span>
                {explicitVibes.slice(0, 5).map((v) => (
                  <span key={v} className="bg-white/15 border border-white/35 text-white/90 px-2 py-0.5 font-black">
                    {v.replace(/-/g, " ")}
                  </span>
                ))}
                <span className="text-white/50">— tuned to your preferences</span>
              </div>
            )}
          </div>

          {/* Sorting and Mode Tabs */}
          {!debouncedSearch ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-[10px] tracking-wider uppercase text-white font-bold border-b border-white/20 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-white/50 font-medium">Sort by:</span>
                <button
                  onClick={() => setSortBy("latest")}
                  className={`px-3 py-1 border transition-all duration-150 rounded-none cursor-pointer ${
                    sortBy === "latest" ? "bg-white text-black border-white" : "border-white/30 text-white hover:border-white"
                  }`}
                >
                  [ Latest ]
                </button>
                <button
                  onClick={() => setSortBy("trending")}
                  className={`px-3 py-1 border transition-all duration-150 rounded-none cursor-pointer ${
                    sortBy === "trending" ? "bg-white text-black border-white" : "border-white/30 text-white hover:border-white"
                  }`}
                >
                  [ Trending ]
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
                <Link
                  href="/upcoming"
                  className="flex items-center gap-1 border border-white/25 px-2.5 py-1 hover:border-white hover:bg-white hover:text-black transition-all duration-150"
                >
                  <Calendar className="w-3 h-3" /> UPCOMING
                </Link>
                <Link
                  href="/random"
                  className="flex items-center gap-1 border border-white/25 px-2.5 py-1 hover:border-white hover:bg-white hover:text-black transition-all duration-150"
                >
                  <Sparkles className="w-3 h-3" /> RANDOM
                </Link>
              </div>
            </div>
          ) : (
            <div className="font-mono text-[10px] tracking-wider uppercase text-white/50 font-bold border-b border-white/20 pb-4">
              Search Results: [ Sorted by Relevance ]
            </div>
          )}

          {loading ? (
            /* Loading Skeleton */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-white bg-black p-4 space-y-4 animate-pulse">
                  <div className="h-40 bg-white/10 w-full"></div>
                  <div className="h-4 bg-white/10 w-3/4"></div>
                  <div className="h-3 bg-white/10 w-1/2"></div>
                </div>
              ))}
            </div>
          ) : games.length === 0 ? (
            /* No Results */
            <div className="text-center py-16 border border-white font-mono text-xs text-white uppercase tracking-widest font-bold">
              [ No horror titles match your current criteria ]
            </div>
          ) : (
            /* Game Grid */
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {games.map((game, index) => (
                  <Link 
                    key={game.id} 
                    href={`/game/${game.slug}`}
                    className="border border-white bg-black rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full"
                  >
                    {/* Cover Image */}
                    <div className={`relative w-full bg-neutral-900 border-b border-white overflow-hidden shrink-0 flex items-center justify-center ${
                      game.slug.startsWith("itch-") ? "aspect-[5/4]" : "aspect-[3/4]"
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
                          <span className={`absolute top-2 left-2 font-mono text-[8px] uppercase tracking-widest border font-black px-1.5 py-0.5 z-10 ${bgClass}`}>
                            {badge}
                          </span>
                        );
                      })()}
                      {/* itch.io Badge */}
                      {game.slug.startsWith("itch-") && (
                        <span className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-widest bg-[#fa5c5c] text-black border border-[#fa5c5c] font-black px-1.5 py-0.5 z-10">
                          itch.io
                        </span>
                      )}
                      {/* Primary Mood Tag */}
                      {game.tags && game.tags.length > 0 && (
                        <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                          {game.tags[0].name}
                        </span>
                      )}
                      {/* Age Rating Badge */}
                      {(game.esrbRating || game.pegiRating) && (
                        <span className="absolute bottom-2 right-2 font-mono text-[8px] uppercase bg-black text-white border border-white font-black px-1.5 py-0.5 z-10 select-none group-hover:bg-white group-hover:text-black group-hover:border-black transition-all duration-150">
                          {game.esrbRating ? getShortEsrbRating(game.esrbRating) : game.pegiRating}
                        </span>
                      )}
                    </div>
                    
                    {/* Game Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-white group-hover:text-black text-sm font-bold tracking-wide uppercase line-clamp-1">
                          {cleanTitle(game.title)}
                        </h4>
                        <span className="font-mono text-[9px] text-white group-hover:text-black block font-bold mt-1">
                          by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/20 font-mono text-[9px]">
                        <PlatformLogos platformNames={game.platformNames} />
                        <span className="px-1.5 py-0.2 border border-white text-white group-hover:text-black group-hover:border-black font-bold">
                          {game.status}
                        </span>
                      </div>
                    </div>
                  </Link>
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
