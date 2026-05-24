"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { Search, Compass, Calendar, Sparkles, BookOpen } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import { getHighResCoverUrl } from "@/lib/utils";
import SciFiLogo from "@/components/SciFiLogo";
import PlatformLogos from "@/components/PlatformLogos";

interface GameData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  coverUrl: string | null;
  rating: number | null;
  category: number | null;
  esrbRating: string | null;
  pegiRating: string | null;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  tags: Array<{ name: string; slug: string }>;
}

const MOOD_FILTERS = [
  { name: "Dread & Psych", slug: "dread-psychological" },
  { name: "Survival Horror", slug: "survival-horror" },
  { name: "Cosmic Horror", slug: "cosmic-horror" },
  { name: "Body Horror", slug: "body-horror" },
  { name: "Liminal & Surreal", slug: "liminal-surreal" },
  { name: "Folk Horror", slug: "folk-horror" },
  { name: "Found Footage", slug: "found-footage-analog" },
  { name: "Retro PS1", slug: "retro-ps1-vibe" },
  { name: "Mascot Horror", slug: "mascot-horror" },
  { name: "Sci-Fi Horror", slug: "sci-fi-cyber" },
  { name: "Slasher", slug: "slasher-splatter" },
  { name: "Stealth", slug: "no-combat-stealth" },
  { name: "Story-Heavy", slug: "walking-sim-story" },
  { name: "Supernatural", slug: "gothic-supernatural" }
];

const getCategoryBadge = (category: number | null): string | null => {
  if (category === 1) return "DLC";
  if (category === 2) return "Expansion";
  if (category === 4) return "Standalone";
  if (category === 8) return "Remake";
  if (category === 9) return "Remaster";
  return null;
};

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

function GameCatalogHome() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Initialize state from URL query parameters
  const initialSearch = searchParams.get("search") || "";
  const initialTag = searchParams.get("tag") || null;
  const initialSort = (searchParams.get("sort") as "latest" | "trending" | "random") || "latest";

  const [games, setGames] = useState<GameData[]>([]);
  const [totalGames, setTotalGames] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"latest" | "trending" | "random">(initialSort);
  const [shuffleTrigger, setShuffleTrigger] = useState(0);

  const triggerShuffle = () => {
    setShuffleTrigger((prev) => prev + 1);
  };

  // Sync states with browser URL search parameters dynamically
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedTag) params.set("tag", selectedTag);
    if (!debouncedSearch && sortBy && sortBy !== "latest") params.set("sort", sortBy);

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    window.history.replaceState(null, "", newUrl);
  }, [debouncedSearch, selectedTag, sortBy, pathname]);

  // Sync state if browser back/forward navigation triggers URL search parameters update
  useEffect(() => {
    const query = searchParams.get("search") || "";
    const tag = searchParams.get("tag") || null;
    const sort = (searchParams.get("sort") as "latest" | "trending" | "random") || "latest";

    setSearchQuery(query);
    setDebouncedSearch(query);
    setSelectedTag(tag);
    setSortBy(sort);
  }, [searchParams]);

  // Debounce search query to avoid spamming the database FTS index on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Load initial page of games when filters or search terms change
  useEffect(() => {
    async function fetchInitialGames() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.set("search", debouncedSearch);
        if (selectedTag) queryParams.set("tag", selectedTag);
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
  }, [debouncedSearch, selectedTag, sortBy, shuffleTrigger]);

  // Load subsequent pages (Load More / Infinite scroll chunks)
  async function loadMoreGames() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch) queryParams.set("search", debouncedSearch);
      if (selectedTag) queryParams.set("tag", selectedTag);
      if (!debouncedSearch && sortBy) queryParams.set("sort", sortBy);
      queryParams.set("cursor", nextCursor);
      queryParams.set("limit", "20");

      const response = await fetch(`/api/games?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setGames((prev: GameData[]) => {
          const incoming: GameData[] = data.games || [];
          const existingIds = new Set(prev.map((g: GameData) => g.id));
          const filteredIncoming = incoming.filter((g: GameData) => !existingIds.has(g.id));
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
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      {/* Top Header */}
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <SciFiLogo withLink={false} />
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-white uppercase font-bold">
              <span>Game Mega Metadata</span>
              <span className="text-white font-black">•</span>
              <span>{loading || totalGames === null ? "HORROR DATABASE" : `${totalGames} GAMES ON OUR DATABASE`}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthButton />
            <Link 
              href="/docs" 
              className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>[ Technical Docs ]</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-16">
        
        {/* Core Vision Intro */}
        <section className="text-center py-8 space-y-4 max-w-2xl mx-auto border-b border-white pb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Discover Horror Games Instantly.
          </h2>
          <p className="text-sm text-white font-medium leading-relaxed">
            "Fast, Minimal and Useful. No comments, reviews, likes, feeds, or unnecessary social clutter. Minimalistic video game discovery and metadata preservation website."
          </p>
        </section>

        {/* Search Input Section */}
        <section className="max-w-2xl mx-auto space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, developer, genre..." 
              className="block w-full pl-10 pr-4 py-3 bg-black border border-white rounded-none focus:outline-none text-sm text-white placeholder-white/50 transition-all duration-150 font-medium"
            />
          </div>
          
          {/* Quick Filter Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[9px] tracking-wider uppercase text-white font-bold">
            <span className="text-white font-black">Moods:</span>
            <button 
              onClick={() => setSelectedTag(null)}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedTag === null ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              All
            </button>
            {MOOD_FILTERS.map((mood) => (
              <button 
                key={mood.slug}
                onClick={() => setSelectedTag(mood.slug)}
                className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                  selectedTag === mood.slug ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
                }`}
              >
                {mood.name}
              </button>
            ))}
          </div>
        </section>

        {/* Catalog Mapping Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-white pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-white" />
              <h3 className="text-sm font-mono uppercase tracking-widest text-white font-bold">browse the catalog</h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-white font-bold">
              <Link 
                href="/upcoming"
                className="flex items-center gap-1 hover:underline text-white font-black"
              >
                <Calendar className="w-3 h-3" /> UPCOMING
              </Link>
              <Link 
                href="/random"
                className="flex items-center gap-1 hover:underline text-white font-black"
              >
                <Sparkles className="w-3 h-3" /> RANDOM
              </Link>
            </div>
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
                <button
                  onClick={() => setSortBy("random")}
                  className={`px-3 py-1 border transition-all duration-150 rounded-none cursor-pointer ${
                    sortBy === "random" ? "bg-white text-black border-white" : "border-white/30 text-white hover:border-white"
                  }`}
                >
                  [ Random Shuffle ]
                </button>
              </div>
              {sortBy === "random" && (
                <button
                  onClick={triggerShuffle}
                  className="px-3 py-1 border border-white text-white hover:bg-white hover:text-black transition-all duration-150 rounded-none flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" /> Shuffle Again
                </button>
              )}
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
                    <div className="aspect-[3/4] relative w-full bg-neutral-900 border-b border-white overflow-hidden shrink-0 flex items-center justify-center">
                      {game.coverUrl ? (
                        <Image
                          src={getHighResCoverUrl(game.coverUrl) || ""}
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
                      {getCategoryBadge(game.category) && (
                        <span className="absolute top-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-[#7f1d1d] text-[#fca5a5] border border-[#fca5a5] font-black px-1.5 py-0.5 z-10">
                          {getCategoryBadge(game.category)}
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
                          {game.title}
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

        {/* Feature Index Navigation */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white pt-12">
          {/* Upcoming releases list link */}
          <Link
            href="/upcoming"
            className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150 space-y-2 text-left block"
          >
            <span className="font-mono text-[9px] text-white group-hover:text-black uppercase tracking-widest block font-bold">Feature Matrix</span>
            <h4 className="text-white group-hover:text-black text-base font-bold">Release Calendar</h4>
            <p className="text-xs text-white group-hover:text-black leading-relaxed font-medium">
              Track emerging horror titles, release timelines, and official store page links without marketing fluff.
            </p>
          </Link>

          {/* Randomizer route spec */}
          <Link
            href="/random"
            className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150 space-y-2 text-left block"
          >
            <span className="font-mono text-[9px] text-white group-hover:text-black uppercase tracking-widest block font-bold">Discovery Engine</span>
            <h4 className="text-white group-hover:text-black text-base font-bold">Instantly Discover</h4>
            <p className="text-xs text-white group-hover:text-black leading-relaxed font-medium">
              Get redirected to a completely random curated horror profile in the database instantly.
            </p>
          </Link>

          {/* Tracking user profile lists */}
          <Link
            href="/dashboard"
            className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150 space-y-2 text-left block"
          >
            <span className="font-mono text-[9px] text-white group-hover:text-black uppercase tracking-widest block font-bold">User System</span>
            <h4 className="text-white group-hover:text-black text-base font-bold">Private Dashboards</h4>
            <p className="text-xs text-white group-hover:text-black leading-relaxed font-medium">
              Manage your personal wishlist and track owned, playing, and completed games via Supabase auth.
            </p>
          </Link>
        </section>

      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">[ INITIALIZING SYSTEMS... ]</div>}>
      <GameCatalogHome />
    </Suspense>
  );
}
