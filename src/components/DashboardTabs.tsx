"use client";

import { useState } from "react";
import Link from "next/link";
import { getHighResCoverUrl } from "@/lib/utils";

interface Game {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  coverUrl: string | null;
  developers: Array<{ name: string; slug: string }>;
  genres: Array<{ name: string; slug: string }>;
  platforms: Array<{ name: string; slug: string }>;
}

interface CollectionItem {
  status: string;
  game: Game;
}

interface DashboardTabsProps {
  wishlist: Game[];
  collection: CollectionItem[];
}

export default function DashboardTabs({ wishlist, collection }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("wishlist");

  // Categorize collection items
  const playing = collection.filter((c) => c.status === "PLAYING").map((c) => c.game);
  const completed = collection.filter((c) => c.status === "COMPLETED").map((c) => c.game);
  const wantToPlay = collection.filter((c) => c.status === "WANT_TO_PLAY").map((c) => c.game);
  const owned = collection.filter((c) => c.status === "OWNED").map((c) => c.game);

  const getActiveList = () => {
    switch (activeTab) {
      case "wishlist":
        return wishlist;
      case "PLAYING":
        return playing;
      case "COMPLETED":
        return completed;
      case "WANT_TO_PLAY":
        return wantToPlay;
      case "OWNED":
        return owned;
      default:
        return [];
    }
  };

  const activeList = getActiveList();

  const tabs = [
    { label: `Wishlist (${wishlist.length})`, value: "wishlist" },
    { label: `Playing (${playing.length})`, value: "PLAYING" },
    { label: `Completed (${completed.length})`, value: "COMPLETED" },
    { label: `Want to Play (${wantToPlay.length})`, value: "WANT_TO_PLAY" },
    { label: `Owned (${owned.length})`, value: "OWNED" },
  ];

  return (
    <div className="space-y-8">
      {/* Tabs Selector Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white pb-6 font-mono text-[10px] uppercase font-bold tracking-wider">
        {tabs.map((tab) => {
          const selected = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 border transition-all duration-150 rounded-none cursor-pointer ${
                selected
                  ? "bg-white text-black border-white"
                  : "bg-black text-white border-white hover:bg-white hover:text-black"
              }`}
            >
              {selected ? `[ ${tab.label} ]` : tab.label}
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="space-y-6">
        {activeList.length === 0 ? (
          <div className="text-center py-20 border border-white border-dashed font-mono text-xs text-white/50 uppercase tracking-widest font-bold">
            [ No horror titles logged under this specification ]
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {activeList.map((game) => (
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
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white">No Cover</span>
                    </div>
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
                      {game.platforms.map((p) => p.name).slice(0, 2).join(", ")}
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
      </div>
    </div>
  );
}
