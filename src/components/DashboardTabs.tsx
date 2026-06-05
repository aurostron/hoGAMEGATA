"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge } from "@/lib/utils";
import PlatformLogos from "@/components/PlatformLogos";

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
                key={game.id}
                href={`/game/${game.slug}`}
                className="border border-white bg-black rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full"
              >
                {/* Cover Image */}
                <div className="aspect-[3/4] relative w-full bg-neutral-900 border-b border-white overflow-hidden shrink-0 flex items-center justify-center">
                  {game.coverUrl ? (
                    <Image
                      src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending) || ""}
                      alt={game.title}
                      fill={true}
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
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
                  {/* itch.io Badge */}
                  {game.slug.startsWith("itch-") && (
                    <span className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-widest bg-[#fa5c5c] text-white border border-[#fa5c5c] font-black px-1.5 py-0.5 z-10">
                      itch.io
                    </span>
                  )}
                  {/* Primary Genre Tag */}
                  <span className="absolute bottom-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
                    {game.genreNames ? game.genreNames.split(", ")[0] : "Horror"}
                  </span>
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
        )}
      </div>
    </div>
  );
}
