"use client";

import { useState } from "react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge } from "../lib/utils";
import PlatformLogos from "./PlatformLogos";

interface Game {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  coverUrl: string | null;
  isTrending?: boolean;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  category: number | null;
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
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-6 text-[11px] uppercase tracking-wider font-semibold">
        {tabs.map((tab) => {
          const selected = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 border transition-all duration-200 rounded-xl cursor-pointer ${
                selected
                  ? "bg-white text-black border-white font-bold"
                  : "bg-white/5 text-white border-white/5 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="space-y-6">
        {activeList.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 text-xs text-neutral-500 uppercase tracking-widest font-semibold rounded-2xl">
            [ No horror titles logged under this specification ]
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {activeList.map((game) => (
              <a
                key={game.id}
                href={`/game/${game.slug}`}
                className="border border-white/5 bg-[#131316]/50 rounded-2xl overflow-hidden hover:border-white/10 hover:bg-white/5 transition-all duration-300 shadow-xl group flex flex-col h-full"
              >
                {/* Cover Image */}
                <div className="aspect-[3/4] relative w-full bg-neutral-900 border-b border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {game.coverUrl ? (
                    <img
                      src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending) || ""}
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
                  {/* Primary Genre Tag */}
                  <span className="absolute bottom-2 left-2 text-[8px] uppercase tracking-widest bg-zinc-900/90 text-white/80 border border-white/10 font-bold px-1.5 py-0.5 rounded">
                    {game.genreNames ? game.genreNames.split(", ")[0] : "Horror"}
                  </span>
                </div>

                {/* Game Details */}
                <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-white text-sm font-semibold tracking-wide line-clamp-1 transition-colors">
                      {game.title}
                    </h4>
                    <span className="text-[10px] text-neutral-450 block mt-1 font-medium">
                      by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 font-mono text-[9px]">
                    <PlatformLogos platformNames={game.platformNames} />
                    <span className="px-2 py-0.5 border border-white/10 text-white/70 text-[9px] font-mono font-semibold uppercase tracking-wider rounded">
                      {game.status}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
