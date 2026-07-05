"use client";

import { useState, useEffect } from "react";
import { Star, Heart, Calendar, Check } from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle, stripHtml } from "../lib/utils";
import PlatformLogos from "./PlatformLogos";
import type { HeroGameData } from "./HeroCarousel";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import HoverTrailer from "./HoverTrailer";

interface TabCatalogProps {
  latest: HeroGameData[];
  trending: HeroGameData[];
  upcoming: HeroGameData[];
  topRated: HeroGameData[];
  activeRegion: string;
  onBrowseAll?: (tab: "latest" | "trending" | "top-rated" | "upcoming" | "for-you") => void;
}

const formatPrice = (amount: number, currencyCode: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
};

export default function TabCatalog({
  latest,
  trending,
  upcoming,
  topRated,
  activeRegion,
  onBrowseAll
}: TabCatalogProps) {
  const { user } = useAuth();
  const { cartItems, addToCart, removeFromCart } = useCart();
  
  type TabKey = "latest" | "trending" | "upcoming" | "top-rated" | "for-you";
  const [activeTab, setActiveTab] = useState<TabKey>("latest");
  const [wishedMap, setWishedMap] = useState<Record<string, boolean>>({});

  // For You States
  const [forYouGames, setForYouGames] = useState<HeroGameData[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [vibes, setVibes] = useState<string[]>([]);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  // Load wishlist state from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("gamegata_wishlist") || "[]");
      const mapped: Record<string, boolean> = {};
      if (Array.isArray(saved)) {
        saved.forEach((id: string) => {
          mapped[id] = true;
        });
      }
      setWishedMap(mapped);
    } catch { /* ignore */ }
  }, []);

  // Hydrate onboarding vibes on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("gamegata_vibes");
        const onboarded = localStorage.getItem("gamegata_onboarded") === "true";
        if (saved) setVibes(JSON.parse(saved));
        setHasOnboarded(onboarded);
      } catch { /* ignore */ }
    }
  }, []);

  // Listen for onboarding vibe updates
  useEffect(() => {
    const handlePrefsUpdate = () => {
      try {
        const saved = localStorage.getItem("gamegata_vibes");
        const onboarded = localStorage.getItem("gamegata_onboarded") === "true";
        if (saved) setVibes(JSON.parse(saved));
        setHasOnboarded(onboarded);
      } catch { /* ignore */ }
    };
    window.addEventListener("gamegata_prefs_updated", handlePrefsUpdate);
    return () => window.removeEventListener("gamegata_prefs_updated", handlePrefsUpdate);
  }, []);

  // Fetch For You Games
  useEffect(() => {
    if (activeTab === "for-you" && vibes.length > 0 && forYouGames.length === 0) {
      const fetchForYou = async () => {
        setForYouLoading(true);
        try {
          const response = await fetch(`/api/games?tags=${encodeURIComponent(vibes.join(","))}&limit=10`);
          if (response.ok) {
            const data = await response.json();
            setForYouGames(data.games || []);
          }
        } catch (err) {
          console.error("Failed to fetch For You recommendations:", err);
        } finally {
          setForYouLoading(false);
        }
      };
      fetchForYou();
    }
  }, [activeTab, vibes, forYouGames.length]);

  // Reset recommendations if vibes change
  useEffect(() => {
    setForYouGames([]);
  }, [vibes]);

  const toggleWish = async (e: React.MouseEvent, gameId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const saved: string[] = JSON.parse(localStorage.getItem("gamegata_wishlist") || "[]");
      const isWished = wishedMap[gameId];
      const next = isWished ? saved.filter(id => id !== gameId) : [...saved, gameId];
      localStorage.setItem("gamegata_wishlist", JSON.stringify(next));
      setWishedMap(prev => ({ ...prev, [gameId]: !isWished }));

      if (user) {
        const method = isWished ? "DELETE" : "POST";
        fetch("/api/user/wishlist", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        }).catch(err => console.error("Cloud wishlist sync toggle failed:", err));
      }
    } catch { /* ignore */ }
  };

  const tabs: Record<TabKey, { label: string; games: HeroGameData[] }> = {
    latest: { label: "LATEST RELEASES", games: latest },
    trending: { label: "POPULAR HORRORS", games: trending },
    upcoming: { label: "UPCOMING", games: upcoming },
    "top-rated": { label: "TOP RATED", games: topRated },
    "for-you": { label: "FOR YOU", games: forYouGames }
  };

  const activeGames = tabs[activeTab].games;

  // Find featured game: first game in activeGames that has screenshots/metadata
  const featuredGame = activeGames[0] || null;
  const gridGames = activeGames.slice(1, 7); // Show next 6 games in the grid

  const getLandscapeImage = (game: HeroGameData) => {
    if (game.screenshots && game.screenshots.length > 0) {
      return game.screenshots[0];
    }
    return game.coverUrl || "";
  };

  const getRepresentativeImage = (games: HeroGameData[]) => {
    if (!games || games.length === 0) return "";
    for (const game of games) {
      const img = getLandscapeImage(game);
      if (img) return img;
    }
    return "";
  };

  const getFeaturedDeal = (game: HeroGameData) => {
    if (!game.priceSnapshots || game.priceSnapshots.length === 0) return null;
    let regional = game.priceSnapshots.filter(p => p.country === activeRegion);
    if (regional.length === 0) {
      regional = game.priceSnapshots.filter(p => p.country === "US");
    }
    if (regional.length === 0) {
      regional = game.priceSnapshots;
    }
    if (regional.length === 0) return null;
    const sorted = [...regional].sort((a, b) => a.dealPrice - b.dealPrice);
    return sorted[0];
  };

  const renderTabCard = (tabKey: TabKey) => {
    const tabInfo = tabs[tabKey];
    const bgImage = getRepresentativeImage(tabInfo.games);
    const isActive = activeTab === tabKey;

    return (
      <button
        key={tabKey}
        onClick={() => setActiveTab(tabKey)}
        className={`relative h-20 w-full overflow-hidden border transition-all duration-200 cursor-pointer text-left flex items-center p-4 rounded-none group
          ${isActive
            ? "border-white opacity-100 scale-100 ring-1 ring-white/30"
            : "border-white/15 opacity-75 hover:opacity-95 hover:border-white/40"
          }`}
      >
        {bgImage && (
          <div className="absolute inset-0 w-full h-full z-0 transition-transform duration-500 group-hover:scale-105">
            <img
              src={bgImage}
              alt=""
              className="w-full h-full object-cover filter brightness-[0.70] group-hover:brightness-[0.85] transition-all duration-300"
            />
            {/* Red tint overlay on hover */}
            <div className="absolute inset-0 bg-[#ff2a2a]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/5 z-5" />
        <div className="relative z-10 font-mono text-xs sm:text-sm font-black uppercase tracking-widest text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {tabKey.replace("-", " ")}
        </div>
      </button>
    );
  };

  const handleBrowseAllClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (activeTab === "upcoming") {
      window.location.assign("/upcoming");
    } else if (onBrowseAll) {
      onBrowseAll(activeTab);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Row: 5 GOG-Style Tab selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {renderTabCard("latest")}
        {renderTabCard("trending")}
        {renderTabCard("upcoming")}
        {renderTabCard("top-rated")}
        {renderTabCard("for-you")}
      </div>

      {/* 2. Active Tab Main Container (Background of active featured game) */}
      <div className="relative border border-white/20 bg-neutral-950 p-6 md:p-8 overflow-hidden">
        {activeTab === "for-you" && (!hasOnboarded || vibes.length === 0) ? (
          <div className="relative z-10 flex flex-col items-center justify-center text-center py-16 px-6 gap-6 border border-white/10 bg-black/60">
            <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center bg-white/5 text-white animate-pulse">
              ★
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-widest leading-none">
                Curate Your Nightmare
              </h3>
              <p className="text-xs sm:text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
                We personalize this feed based on your horror tastes. Complete the quick setup to unlock recommendations.
              </p>
            </div>
            <button
              onClick={() => window.dispatchEvent(new Event("gamegata_open_modal"))}
              className="px-6 py-3 bg-white text-black hover:bg-[#ff2a2a] hover:text-white border border-white hover:border-[#ff2a2a] font-mono text-xs font-black uppercase tracking-wider transition-colors duration-150 cursor-pointer"
            >
              [ CURATE PREFERENCES ]
            </button>
          </div>
        ) : activeTab === "for-you" && forYouLoading ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-20 gap-3 min-h-[300px]">
            <span className="font-mono text-xs text-white/40 animate-pulse">[ CURATING YOUR FEED... ]</span>
          </div>
        ) : activeTab === "for-you" && forYouGames.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-16 text-center border border-white/10 bg-black/60 gap-4">
            <p className="font-mono text-xs text-white/50 uppercase">[ No custom recommendations match your selected vibes ]</p>
            <button
              onClick={() => window.dispatchEvent(new Event("gamegata_open_modal"))}
              className="px-4 py-2 border border-white/20 hover:border-white text-white/60 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors duration-150 cursor-pointer"
            >
              [ ADJUST PREFERENCES ]
            </button>
          </div>
        ) : (
          <>
        {featuredGame && getLandscapeImage(featuredGame) && (
          <div className="absolute inset-0 z-0 select-none pointer-events-none opacity-[0.14] mix-blend-screen">
            <img
              src={getLandscapeImage(featuredGame)}
              alt=""
              className="w-full h-full object-cover filter blur-xs"
            />
            {/* Radial gradient mask to fade background edges into page */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#030303_95%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]" />
          </div>
        )}

        {/* Storefront Layout */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Featured Card */}
          {featuredGame ? (
            (() => {
              const game = featuredGame;
              const deal = getFeaturedDeal(game);
              const badge = getCategoryBadge(game.category, game.title);
              const summaryText = stripHtml(game.summary || "");
              const isVN = badge === "Visual Novel";
              const badgeBg = isVN ? "bg-[#581c87] text-[#f5d0fe] border-[#f5d0fe]" : "bg-[#7f1d1d] text-[#fca5a5] border-[#fca5a5]";
              
              const storeKey = deal ? deal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
              const directLink = deal
                ? `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`
                : `/game/${game.slug}`;

              const isWished = wishedMap[game.id] || false;
              const isSpotlightInCart = cartItems.some(i => i.gameId === game.id);

              return (
                <div className="border border-white/20 bg-black/85 backdrop-blur-xs p-5 flex flex-col justify-between gap-5 relative h-full">
                  <div className="space-y-4">
                    {/* Landscape Artwork */}
                    <a href={`/game/${game.slug}`} className="block relative aspect-video w-full overflow-hidden border border-white/10 bg-neutral-900 group/img">
                      <HoverTrailer
                        trailerUrl={game.trailerUrl}
                        coverUrl={getLandscapeImage(game)}
                        altText={game.title}
                        aspectClass="w-full h-full"
                      />
                      {badge && (
                        <span className={`absolute top-2 left-2 font-mono text-[9px] uppercase tracking-widest border font-black px-1.5 py-0.5 z-10 ${badgeBg}`}>
                          {badge}
                        </span>
                      )}
                      {game.rating && (
                        <span className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-widest bg-black text-amber-400 font-black border border-white/25 px-1.5 py-0.5 z-10 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> {(game.rating / 10).toFixed(1)}
                        </span>
                      )}
                    </a>

                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <a href={`/game/${game.slug}`} className="hover:underline">
                          <h3 className="text-lg font-black uppercase text-white tracking-wide line-clamp-1 leading-snug">
                            {cleanTitle(game.title)}
                          </h3>
                        </a>
                      </div>

                      <span className="font-mono text-[10px] sm:text-xs text-white/50 block font-bold leading-normal">
                        by {game.developerNames ? game.developerNames.split(", ")[0].toUpperCase() : "UNKNOWN DEVELOPER"}
                      </span>

                      {summaryText && (
                        <p className="text-xs text-white/60 font-medium leading-relaxed line-clamp-3 pt-1">
                          {summaryText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="border-t border-white/10 pt-4 flex items-center justify-between mt-auto">
                    {deal ? (
                      <div className="flex flex-col justify-center">
                        <span className="font-mono text-sm font-black text-emerald-400">
                          {formatPrice(deal.dealPrice, deal.currency)}
                        </span>
                        {deal.discountPercent > 0 && (
                          <span className="font-mono text-[9px] text-white/40 line-through leading-none mt-0.5">
                            {formatPrice(deal.retailPrice, deal.currency)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-white/40 uppercase tracking-widest">—</span>
                    )}

                    <div className="flex items-center gap-2">
                      {/* Cart toggle button */}
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isSpotlightInCart) {
                            await removeFromCart(game.id);
                          } else {
                            await addToCart(game);
                            window.dispatchEvent(new Event("gamegata_open_cart"));
                          }
                        }}
                        className={`w-8 h-8 border flex items-center justify-center transition-colors duration-150 cursor-pointer rounded-none
                          ${isSpotlightInCart
                            ? "bg-[#7b3fc4] border-[#7b3fc4] text-white"
                            : "bg-black border-white/20 text-white/50 hover:bg-white hover:border-white hover:text-black"
                          }`}
                        title={isSpotlightInCart ? "Remove from cart" : "Add to cart"}
                      >
                        {isSpotlightInCart ? (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                          </svg>
                        )}
                      </button>

                      <button
                        onClick={(e) => toggleWish(e, game.id)}
                        className={`w-8 h-8 border flex items-center justify-center transition-colors duration-150 cursor-pointer rounded-none
                          ${isWished
                            ? "bg-red-950 border-red-500 text-red-500"
                            : "bg-black border-white/20 text-white/50 hover:bg-white hover:border-white hover:text-black"
                          }`}
                        title={isWished ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        <Heart className="w-3.5 h-3.5" fill={isWished ? "currentColor" : "none"} />
                      </button>

                      <a
                        href={directLink}
                        target={deal ? "_blank" : undefined}
                        rel={deal ? "noopener noreferrer" : undefined}
                        className="font-mono text-[10px] font-black uppercase tracking-wider bg-white text-black hover:bg-[#ff2a2a] hover:text-white border border-white hover:border-[#ff2a2a] px-3.5 py-2 transition-colors duration-150 rounded-none leading-none block text-center cursor-pointer"
                      >
                        {deal ? "[ BUY ]" : "[ DETAILS ]"}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="border border-white/20 bg-black/60 p-5 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-white/30 h-full">
              No featured metadata
            </div>
          )}

          {/* Right Grid of 6 smaller compact cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {gridGames.length > 0 ? (
              gridGames.map((game, idx) => {
                const deal = getFeaturedDeal(game);
                const badge = getCategoryBadge(game.category, game.title);
                const hasDiscount = deal && deal.discountPercent > 0;
                const isVN = badge === "Visual Novel";
                const badgeBg = isVN ? "bg-[#581c87] text-[#f5d0fe] border-[#f5d0fe]" : "bg-[#7f1d1d] text-[#fca5a5] border-[#fca5a5]";
                const isInGridCart = cartItems.some(i => i.gameId === game.id);
                
                const storeKey = deal ? deal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
                const directLink = deal
                  ? `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`
                  : `/game/${game.slug}`;

                return (
                  <a
                    key={game.id}
                    href={`/game/${game.slug}`}
                    className="border border-white/15 hover:border-white bg-black/75 hover:bg-white hover:text-black group transition-all duration-150 flex flex-col justify-between p-3 select-none h-full relative"
                  >
                    <div className="space-y-2.5">
                      {/* Compact cover thumbnail with fixed aspect */}
                      <div className="relative aspect-video w-full bg-neutral-900 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                        <HoverTrailer
                          trailerUrl={game.trailerUrl}
                          coverUrl={getLandscapeImage(game)}
                          altText={game.title}
                          aspectClass="w-full h-full"
                        />
                        {badge && (
                          <span className={`absolute top-1 left-1 font-mono text-[8px] uppercase tracking-widest border font-black px-1 py-0.2 z-10 ${badgeBg}`}>
                            {badge}
                          </span>
                        )}
                        {game.rating && (
                          <span className="absolute bottom-1 left-1 font-mono text-[8px] bg-black text-amber-400 group-hover:bg-white group-hover:text-black border border-white/20 group-hover:border-black/20 px-1 py-0.2 z-10 flex items-center gap-0.5 leading-none">
                            <Star className="w-2.5 h-2.5 fill-current" /> {(game.rating / 10).toFixed(1)}
                          </span>
                        )}

                        {/* Floating Add to Cart for Compact Card */}
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isInGridCart) {
                              await removeFromCart(game.id);
                            } else {
                              // Reconstruct partial game object for context logic
                              const gameMock = {
                                id: game.id,
                                title: game.title,
                                slug: game.slug,
                                coverUrl: game.coverUrl,
                                priceSnapshots: game.priceSnapshots || (deal ? [deal] : []),
                              };
                              await addToCart(gameMock);
                              window.dispatchEvent(new Event("gamegata_open_cart"));
                            }
                          }}
                          title={isInGridCart ? "Remove from cart" : "Add to cart"}
                          className={`absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center border transition-all duration-150 cursor-pointer select-none md:opacity-0 group-hover:opacity-100
                            ${isInGridCart
                              ? "bg-[#7b3fc4] border-[#7b3fc4] text-white opacity-100!"
                              : "bg-black/85 border-white/20 text-white/70 hover:bg-white hover:text-black hover:border-white"
                            }`}
                        >
                          {isInGridCart ? (
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          ) : (
                            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2}>
                              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                            </svg>
                          )}
                        </button>
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="text-white group-hover:text-black font-extrabold tracking-wide uppercase line-clamp-1 leading-snug text-xs">
                          {cleanTitle(game.title)}
                        </h4>
                        <span className="font-mono text-[9px] text-white/50 group-hover:text-black/50 block font-bold leading-normal">
                          by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom row specs + pricing */}
                    <div className="flex items-center justify-between border-t border-white/10 group-hover:border-black/10 pt-2.5 mt-3 font-mono text-[9px] shrink-0">
                      <PlatformLogos platformNames={game.platformNames} />
                      
                      <div className="flex items-center gap-1.5 font-bold">
                        {deal ? (
                          <>
                            {hasDiscount && (
                              <span className="bg-[#7b3fc4] text-white group-hover:bg-[#ff2a2a] group-hover:text-white px-1 py-0.2 font-black leading-none">
                                -{deal.discountPercent}%
                              </span>
                            )}
                            <span className="text-emerald-400 group-hover:text-emerald-800 leading-none">
                              {formatPrice(deal.dealPrice, deal.currency)}
                            </span>
                          </>
                        ) : (
                          <span className="text-white/30 group-hover:text-black/30 leading-none">—</span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })
            ) : (
              <div className="col-span-3 border border-white/20 bg-black/40 p-10 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-white/30">
                No extra data indexed
              </div>
            )}
          </div>

        </div>

        {/* View all row inside container */}
        <div className="relative z-10 flex justify-end border-t border-white/15 pt-4 mt-6">
          <button
            onClick={handleBrowseAllClick}
            className="font-mono text-[10px] uppercase font-bold tracking-widest text-white/60 hover:text-white transition-colors cursor-pointer border border-white/20 hover:border-white px-4 py-2 bg-black/40 hover:bg-black/90 rounded-none flex items-center gap-1.5"
          >
            {activeTab === "upcoming" ? "[ VIEW RELEASE CALENDAR ]" : `[ BROWSE ALL ${tabs[activeTab].label} ]`}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
