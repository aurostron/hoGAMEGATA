"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import MiniSearch from "minisearch";
import { Search, Compass, Calendar, Sparkles, BookOpen } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import { getHighResCoverUrl } from "@/lib/utils";

interface GameData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  coverUrl: string | null;
  rating: number | null;
  category: number | null;
  developers: Array<{ name: string; slug: string }>;
  genres: Array<{ name: string; slug: string }>;
  platforms: Array<{ name: string; slug: string }>;
}

const getCategoryBadge = (category: number | null): string | null => {
  if (category === 1) return "DLC";
  if (category === 2) return "Expansion";
  if (category === 4) return "Standalone";
  if (category === 8) return "Remake";
  if (category === 9) return "Remaster";
  return null;
};

export default function Home() {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // Fetch games on mount
  useEffect(() => {
    async function fetchGames() {
      try {
        const response = await fetch("/api/games");
        if (response.ok) {
          const data = await response.json();
          setGames(data);
        }
      } catch (err) {
        console.error("❌ Error fetching catalog:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGames();
  }, []);

  // Initialize and populate MiniSearch index memoized
  const miniSearch = useMemo(() => {
    if (games.length === 0) return null;

    const ms = new MiniSearch({
      fields: ["title", "developerNames", "genreNames", "platformNames"],
      storeFields: ["id"],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
      },
    });

    // Map relations for search indexing
    const documents = games.map((g) => ({
      id: g.id,
      title: g.title,
      developerNames: g.developers.map((d) => d.name).join(" "),
      genreNames: g.genres.map((gen) => gen.name).join(" "),
      platformNames: g.platforms.map((p) => p.name).join(" "),
    }));

    ms.addAll(documents);
    return ms;
  }, [games]);

  // Compute filtered games list
  const filteredGames = useMemo(() => {
    let resultList = games;

    // Apply search query via MiniSearch if active
    if (searchQuery.trim() !== "" && miniSearch) {
      const searchResults = miniSearch.search(searchQuery);
      const matchedIds = new Set(searchResults.map((r) => r.id));
      resultList = games.filter((g) => matchedIds.has(g.id));
    }

    // Apply selected genre filter tag
    if (selectedGenre) {
      resultList = resultList.filter((g) =>
        g.genres.some((genre) =>
          genre.name.toLowerCase().includes(selectedGenre.toLowerCase())
        )
      );
    }

    return resultList;
  }, [games, searchQuery, selectedGenre, miniSearch]);



  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      {/* Top Header */}
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              <span className="italic">ho</span>GAMEGATA.
            </h1>
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-white uppercase font-bold">
              <span>Game Mega Metadata Registry</span>
              <span className="text-white font-black">•</span>
              <span>{loading ? "HORROR DATABASE" : `${games.length} GAMES ON OUR DATABASE`}</span>
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
            Discover Horror Instantly.
          </h2>
          <p className="text-sm text-white font-medium leading-relaxed">
            "A minimalistic horror game discovery website focused on horror games. Fast → Minimal → Useful. No comments, reviews, likes, feeds, or unnecessary social clutter."
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
              placeholder="Instant typo-tolerant search by title, developer, genre..." 
              className="block w-full pl-10 pr-4 py-3 bg-black border border-white rounded-none focus:outline-none text-sm text-white placeholder-white/50 transition-all duration-150 font-medium"
            />
          </div>
          
          {/* Quick Filter Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] tracking-wider uppercase text-white font-bold">
            <span className="text-white font-black">Filters:</span>
            <button 
              onClick={() => setSelectedGenre(null)}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedGenre === null ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setSelectedGenre("Adventure")}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedGenre === "Adventure" ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              Adventure
            </button>
            <button 
              onClick={() => setSelectedGenre("Indie")}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedGenre === "Indie" ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              Indie
            </button>
            <button 
              onClick={() => setSelectedGenre("Shooter")}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedGenre === "Shooter" ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              Shooter
            </button>
            <button 
              onClick={() => setSelectedGenre("Puzzle")}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedGenre === "Puzzle" ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              Puzzle
            </button>
            <button 
              onClick={() => setSelectedGenre("RPG")}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedGenre === "RPG" ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              RPG
            </button>
            <button 
              onClick={() => setSelectedGenre("Simulator")}
              className={`border border-white px-2.5 py-0.5 rounded-none transition-all duration-150 ${
                selectedGenre === "Simulator" ? "bg-white text-black" : "bg-black text-white hover:bg-white hover:text-black"
              }`}
            >
              Simulator
            </button>
          </div>
        </section>

        {/* Catalog Mapping Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-white pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-white" />
              <h3 className="text-sm font-mono uppercase tracking-widest text-white font-bold">Catalog Mapping</h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-white font-bold">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 
                {games.filter(g => g.status === "upcoming").length} Upcoming
              </span>
              <Link 
                href="/random"
                className="flex items-center gap-1 hover:underline text-white font-black"
              >
                <Sparkles className="w-3 h-3" /> Random Play
              </Link>
            </div>
          </div>

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
          ) : filteredGames.length === 0 ? (
            /* No Results */
            <div className="text-center py-16 border border-white font-mono text-xs text-white uppercase tracking-widest font-bold">
              [ No horror titles match your current criteria ]
            </div>
          ) : (
            /* Game Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {filteredGames.map((game) => (
                <Link 
                  key={game.slug} 
                  href={`/game/${game.slug}`}
                  className="border border-white bg-black rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full"
                >
                  {/* Cover Image */}
                  <div className="aspect-[3/4] relative w-full bg-black border-b border-white overflow-hidden shrink-0 flex items-center justify-center">
                    {game.coverUrl ? (
                      <img
                        src={getHighResCoverUrl(game.coverUrl) || ""}
                        alt={game.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
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
                    {/* Primary Genre Tag */}
                    <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                      {game.genres[0]?.name || "Horror"}
                    </span>
                  </div>
                  
                  {/* Game Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-white group-hover:text-black text-sm font-bold tracking-wide uppercase line-clamp-1">
                        {game.title}
                      </h4>
                      <span className="font-mono text-[9px] text-white group-hover:text-black block font-bold mt-1">
                        by {game.developers[0]?.name || "Unknown Dev"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/20 font-mono text-[9px]">
                      <span className="text-white group-hover:text-black font-bold truncate max-w-[120px]">
                        {game.platforms.map(p => p.name).slice(0, 2).join(", ")}
                      </span>
                      <span className="px-1.5 py-0.2 border border-white text-white group-hover:text-black group-hover:border-black font-bold">
                        {game.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Feature Index Navigation */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white pt-12">
          {/* Upcoming releases list link */}
          <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150 space-y-2">
            <span className="font-mono text-[9px] text-white group-hover:text-black uppercase tracking-widest block font-bold">Feature Matrix</span>
            <h4 className="text-white group-hover:text-black text-base font-bold">Release Calendar</h4>
            <p className="text-xs text-white group-hover:text-black leading-relaxed font-medium">
              Track emerging horror titles, release timelines, and official store page links without marketing fluff.
            </p>
          </div>

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
          <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150 space-y-2">
            <span className="font-mono text-[9px] text-white group-hover:text-black uppercase tracking-widest block font-bold">User System</span>
            <h4 className="text-white group-hover:text-black text-base font-bold">Private Dashboards</h4>
            <p className="text-xs text-white group-hover:text-black leading-relaxed font-medium">
              Manage your personal wishlist and track owned, playing, and completed games via Supabase auth.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
