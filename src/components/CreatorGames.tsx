"use client";

import { useState, useEffect } from "react";
import { Compass } from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge } from "../lib/utils";
import PlatformLogos from "./PlatformLogos";

const formatDate = (dateVal: string | Date | null | undefined) => {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short"
    });
  } catch {
    return "";
  }
};

interface GameData {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  category: number | null;
  tags?: Array<{ name: string; slug: string }>;
  genres?: Array<{ name: string; slug: string }>;
  developers?: Array<{ name: string; slug: string }>;
  platforms?: Array<{ name: string; slug: string }>;
  developerNames?: string | null;
  platformNames?: string | null;
  releaseDate?: string | Date | null;
  trailerUrl?: string | null;
}

interface CreatorGamesProps {
  creatorIds: string[];
  creatorNames: string[];
  excludeGameId: string;
}

export default function CreatorGames({ creatorIds, creatorNames, excludeGameId }: CreatorGamesProps) {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const creatorsString = creatorNames.length > 0 ? creatorNames.join(" & ") : "Same Creators";

  useEffect(() => {
    async function fetchCreatorGames() {
      if (creatorIds.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set("creatorIds", creatorIds.join(","));
        queryParams.set("excludeId", excludeGameId);
        queryParams.set("limit", "4");

        const response = await fetch(`/api/games?${queryParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setGames(data.games || []);
          setNextCursor(data.nextCursor || null);
        }
      } catch (err) {
        console.error("❌ Error fetching creator games:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCreatorGames();
  }, [creatorIds, excludeGameId]);

  async function loadMoreGames() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("creatorIds", creatorIds.join(","));
      queryParams.set("excludeId", excludeGameId);
      queryParams.set("cursor", nextCursor);
      queryParams.set("limit", "4");

      const response = await fetch(`/api/games?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setGames((prev) => [...prev, ...(data.games || [])]);
        setNextCursor(data.nextCursor || null);
      }
    } catch (err) {
      console.error("❌ Error fetching next page of creator games:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <section className="border-t border-white pt-12 space-y-6">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-white" />
          <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">Loading...</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-white bg-black rounded-none overflow-hidden flex flex-col h-full animate-pulse">
              <div className="aspect-[3/4] w-full bg-white/10 border-b border-white shrink-0"></div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="h-4 bg-white/10 w-3/4 rounded-none"></div>
                  <div className="h-3 bg-white/10 w-1/2 rounded-none mt-2"></div>
                </div>
                <div className="pt-2 border-t border-white/20 flex justify-between items-center">
                  <div className="h-3 bg-white/10 w-16 rounded-none"></div>
                  <div className="h-4 bg-white/10 w-12 rounded-none"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (games.length === 0) {
    return null; // Don't show the section if no other games from this creator exist
  }

  return (
    <section className="border-t border-white pt-12 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-white" />
          <h3 className="font-mono text-[10px] text-white uppercase tracking-widest font-black">
            More from {creatorsString}
          </h3>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {games.map((game) => (
          <a
            key={game.slug}
            href={`/game/${game.slug}`}
            className="border border-white bg-black rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full"
          >
            <div className="aspect-[3/4] relative w-full bg-neutral-900 border-b border-white overflow-hidden shrink-0 flex items-center justify-center">
              {game.coverUrl ? (
                <img
                  src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl)) || ""}
                  alt={game.title}
                  className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white">No Cover</span>
                </div>
              )}
              {/* Category Tag */}
              {getCategoryBadge(game.category, game.title) && (
                <span className="absolute top-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-[#7f1d1d] text-[#fca5a5] border border-[#fca5a5] font-black px-1.5 py-0.5 z-10">
                  {getCategoryBadge(game.category, game.title)}
                </span>
              )}
              {/* itch.io Badge */}
              {game.slug.startsWith("itch-") && (
                <span className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-widest bg-[#fa5c5c] text-black border border-[#fa5c5c] font-black px-1.5 py-0.5 z-10">
                  itch.io
                </span>
              )}
              {/* Primary Mood Tag */}
              {game.tags && game.tags.length > 0 ? (
                <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                  {game.tags[0].name}
                </span>
              ) : game.genres && game.genres.length > 0 ? (
                <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                  {game.genres[0].name}
                </span>
              ) : null}
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-white group-hover:text-black text-sm font-bold tracking-wide uppercase line-clamp-1">
                  {game.title}
                </h4>
                <span className="font-mono text-[9px] text-white group-hover:text-black block font-bold mt-1">
                  by {game.developerNames ? game.developerNames.split(", ")[0] : (game.developers?.[0]?.name || "Unknown Dev")}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/20 font-mono text-[9px]">
                <PlatformLogos platforms={game.platforms} platformNames={game.platformNames} />
                <span className="px-1.5 py-0.2 border border-white text-white group-hover:text-black group-hover:border-black font-bold">
                  {game.status === "released" && game.releaseDate ? formatDate(game.releaseDate) : game.status}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {nextCursor && (
        <div className="flex justify-center pt-6">
          <button
            onClick={loadMoreGames}
            disabled={loadingMore}
            className="font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-6 py-3 rounded-none font-bold disabled:opacity-50"
          >
            {loadingMore ? "[ Loading... ]" : "[ Load More ]"}
          </button>
        </div>
      )}
    </section>
  );
}
