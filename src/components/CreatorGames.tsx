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
      <section className="border-t border-white/5 pt-12 space-y-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider animate-pulse">Loading...</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-white/5 bg-[#131316]/50 rounded-2xl overflow-hidden flex flex-col h-full animate-pulse">
              <div className="aspect-[3/4] w-full bg-white/5 border-b border-white/5 shrink-0"></div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="h-4 bg-white/5 w-3/4 rounded"></div>
                  <div className="h-3 bg-white/5 w-1/2 rounded mt-2"></div>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                  <div className="h-3 bg-white/5 w-16 rounded"></div>
                  <div className="h-4 bg-white/5 w-12 rounded"></div>
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
    <section className="border-t border-white/5 pt-12 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            More from {creatorsString}
          </h3>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {games.map((game) => (
          <a
            key={game.slug}
            href={`/game/${game.slug}`}
            className="border border-white/5 bg-[#131316]/50 rounded-2xl overflow-hidden hover:border-white/10 hover:bg-white/5 transition-all duration-300 shadow-xl group flex flex-col h-full"
          >
            <div className="aspect-[3/4] relative w-full bg-neutral-900 border-b border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
              {game.coverUrl ? (
                <img
                  src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl)) || ""}
                  alt={game.title}
                  className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-white/5 to-black flex items-center justify-center">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-450">No Cover</span>
                </div>
              )}
              {/* Category Tag */}
              {getCategoryBadge(game.category, game.title) && (
                <span className="absolute top-2 left-2 text-[8px] uppercase tracking-widest bg-[#7f1d1d]/90 text-[#fca5a5] border border-[#fca5a5]/10 font-bold px-1.5 py-0.5 z-10 rounded">
                  {getCategoryBadge(game.category, game.title)}
                </span>
              )}
              {/* itch.io Badge */}
              {game.slug.startsWith("itch-") && (
                <span className="absolute top-2 right-2 text-[8px] uppercase tracking-widest bg-[#fa5c5c]/95 text-black font-bold px-1.5 py-0.5 z-10 rounded">
                  itch.io
                </span>
              )}
              {/* Primary Mood Tag */}
              {game.tags && game.tags.length > 0 ? (
                <span className="absolute bottom-2 left-2 text-[8px] uppercase tracking-widest bg-zinc-900/90 text-white/80 border border-white/10 font-bold px-1.5 py-0.5 rounded">
                  {game.tags[0].name}
                </span>
              ) : game.genres && game.genres.length > 0 ? (
                <span className="absolute bottom-2 left-2 text-[8px] uppercase tracking-widest bg-zinc-900/90 text-white/80 border border-white/10 font-bold px-1.5 py-0.5 rounded">
                  {game.genres[0].name}
                </span>
              ) : null}
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-white text-sm font-semibold tracking-wide line-clamp-1 transition-colors">
                  {game.title}
                </h4>
                <span className="text-[10px] text-neutral-455 block mt-1 font-medium">
                  by {game.developerNames ? game.developerNames.split(", ")[0] : (game.developers?.[0]?.name || "Unknown Dev")}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 font-mono text-[9px]">
                <PlatformLogos platforms={game.platforms} platformNames={game.platformNames} />
                <span className="px-2 py-0.5 border border-white/10 text-white/70 text-[9px] font-mono font-semibold uppercase tracking-wider rounded">
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
            className="text-xs text-white bg-white/5 hover:bg-white/10 uppercase tracking-wider transition-all duration-200 border border-white/5 px-6 py-3 rounded-xl font-semibold disabled:opacity-50 cursor-pointer"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </section>
  );
}
