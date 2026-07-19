"use client";

import { useState, useEffect } from "react";
import { Star, Heart, Calendar, Check, ArrowRight, Sparkles } from "lucide-react";
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
    latest: { label: "Latest Releases", games: latest },
    trending: { label: "Popular Horrors", games: trending },
    upcoming: { label: "Upcoming Games", games: upcoming },
    "top-rated": { label: "Top Rated", games: topRated },
    "for-you": { label: "For You", games: forYouGames }
  };

  const activeGames = tabs[activeTab].games;
  const featuredGame = activeGames[0] || null;
  const gridGames = activeGames.slice(1, 7);

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
        className={`relative h-24 sm:h-28 w-full overflow-hidden transition-all duration-300 cursor-pointer text-left flex items-center p-5 rounded-2xl group border ${
          isActive
            ? "border-white/30 bg-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.5)] scale-[1.02]"
            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20"
        }`}
      >
        {bgImage && (
          <div className="absolute inset-0 w-full h-full z-0 transition-transform duration-700 group-hover:scale-105">
            <img
              src={bgImage}
              alt=""
              className="w-full h-full object-cover filter brightness-[0.45] group-hover:brightness-[0.60] transition-all duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>
        )}
        <div className="relative z-10 flex flex-col justify-end h-full">
          <span className={`font-sans text-xs sm:text-sm font-bold tracking-wide transition-colors duration-200 ${
            isActive ? "text-white" : "text-white/80 group-hover:text-white"
          }`}>
            {tabInfo.label}
          </span>
          {isActive && (
            <span className="w-5 h-0.5 bg-white rounded-full mt-1.5 transition-all" />
          )}
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
    <div className="space-y-8">
      {/* 1. Top Row: Modern Clean Tab Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {renderTabCard("latest")}
        {renderTabCard("trending")}
        {renderTabCard("upcoming")}
        {renderTabCard("top-rated")}
        {renderTabCard("for-you")}
      </div>

      {/* 2. Main Expansive Container (Seamless Minimalist Surface) */}
      <div className="relative bg-[#0b0b0e] rounded-3xl p-6 sm:p-8 lg:p-10 overflow-hidden shadow-2xl border border-white/[0.06]">
        {activeTab === "for-you" && (!hasOnboarded || vibes.length === 0) ? (
          <div className="relative z-10 flex flex-col items-center justify-center text-center py-20 px-6 gap-6 rounded-2xl bg-white/[0.02]">
            <div className="w-14 h-14 rounded-2xl border border-white/15 flex items-center justify-center bg-white/5 text-white">
              <Sparkles className="w-6 h-6 text-white/80" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-tight">
                Curate Your Nightmare
              </h3>
              <p className="text-xs sm:text-sm text-white/60 font-sans leading-relaxed">
                We personalize this feed based on your horror tastes. Complete the quick setup to unlock recommendations.
              </p>
            </div>
            <button
              onClick={() => window.dispatchEvent(new Event("gamegata_open_modal"))}
              className="px-6 py-3 bg-white text-black hover:bg-white/90 font-sans text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer shadow-lg hover:scale-[0.98]"
            >
              Curate Preferences
            </button>
          </div>
        ) : activeTab === "for-you" && forYouLoading ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-24 gap-3 min-h-[360px]">
            <span className="font-sans text-xs font-medium text-white/50 tracking-wide">Curating your recommendations...</span>
          </div>
        ) : activeTab === "for-you" && forYouGames.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-white/[0.02] gap-4">
            <p className="font-sans text-xs text-white/60">No custom recommendations match your selected vibes</p>
            <button
              onClick={() => window.dispatchEvent(new Event("gamegata_open_modal"))}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-sans text-xs font-medium transition-colors cursor-pointer"
            >
              Adjust Preferences
            </button>
          </div>
        ) : (
          <>
            {featuredGame && getLandscapeImage(featuredGame) && (
              <div className="absolute inset-0 z-0 select-none pointer-events-none opacity-[0.12] mix-blend-screen">
                <img
                  src={getLandscapeImage(featuredGame)}
                  alt=""
                  className="w-full h-full object-cover filter blur-md"
                />
                <div className="absolute inset-0 bg-[#0b0b0e]/80" />
              </div>
            )}

            {/* Storefront Layout Grid */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
              
              {/* Featured Card (Left Side - Taller & Spacing Enhanced) */}
              {featuredGame ? (
                (() => {
                  const game = featuredGame;
                  const deal = getFeaturedDeal(game);
                  const badge = getCategoryBadge(game.category, game.title);
                  const summaryText = stripHtml(game.summary || "");
                  const isVN = badge === "Visual Novel";
                  const badgeBg = isVN ? "bg-purple-950/80 text-purple-200 border-purple-400/30" : "bg-red-950/80 text-red-200 border-red-400/30";
                  
                  const storeKey = deal ? deal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
                  const directLink = deal
                    ? `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`
                    : `/game/${game.slug}`;

                  const isWished = wishedMap[game.id] || false;
                  const isSpotlightInCart = cartItems.some(i => i.gameId === game.id);

                  return (
                    <div className="bg-[#121217]/90 rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 relative h-full border border-white/[0.06] hover:border-white/15 transition-all duration-300 shadow-xl">
                      <div className="space-y-5">
                        {/* Landscape Artwork */}
                        <a href={`/game/${game.slug}`} className="block relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 group/img">
                          <HoverTrailer
                            trailerUrl={game.trailerUrl}
                            coverUrl={getLandscapeImage(game)}
                            altText={game.title}
                            aspectClass="w-full h-full"
                          />
                          {badge && (
                            <span className={`absolute top-3 left-3 font-sans text-[10px] tracking-wide font-medium px-2 py-0.5 z-10 rounded-md backdrop-blur-md border ${badgeBg}`}>
                              {badge}
                            </span>
                          )}
                          {game.rating && (
                            <span className="absolute bottom-3 left-3 font-sans text-[10px] font-semibold bg-black/80 text-amber-400 backdrop-blur-md border border-white/15 px-2 py-0.5 z-10 flex items-center gap-1 rounded-md">
                              <Star className="w-3 h-3 fill-current" /> {(game.rating / 10).toFixed(1)}
                            </span>
                          )}
                        </a>

                        <div className="space-y-2.5">
                          <a href={`/game/${game.slug}`} className="block group/title">
                            <h3 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-tight line-clamp-2 leading-snug group-hover/title:text-white/90 transition-colors">
                              {cleanTitle(game.title)}
                            </h3>
                          </a>

                          <span className="font-sans text-xs text-white/50 block font-medium">
                            by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Developer"}
                          </span>

                          {summaryText && (
                            <p className="text-xs sm:text-sm text-white/65 font-sans leading-relaxed line-clamp-4 pt-1">
                              {summaryText}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions & Price */}
                      <div className="pt-4 flex items-center justify-between mt-auto border-t border-white/[0.06]">
                        {deal ? (
                          <div className="flex flex-col justify-center">
                            <span className="font-sans text-base sm:text-lg font-bold text-emerald-400">
                              {formatPrice(deal.dealPrice, deal.currency)}
                            </span>
                            {deal.discountPercent > 0 && (
                              <span className="font-sans text-xs text-white/40 line-through leading-none mt-0.5">
                                {formatPrice(deal.retailPrice, deal.currency)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-sans text-xs text-white/40 font-medium">—</span>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isSpotlightInCart) {
                                await removeFromCart(game.id);
                              } else {
                                await addToCart(game);
                              }
                            }}
                            className={`w-9 h-9 flex items-center justify-center transition-all duration-200 cursor-pointer rounded-xl ${
                              isSpotlightInCart
                                ? "bg-purple-600 text-white"
                                : "bg-white/5 text-white/70 hover:bg-white hover:text-black"
                            }`}
                            title={isSpotlightInCart ? "Remove from cart" : "Add to cart"}
                          >
                            {isSpotlightInCart ? (
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                              </svg>
                            )}
                          </button>

                          <button
                            onClick={(e) => toggleWish(e, game.id)}
                            className={`w-9 h-9 flex items-center justify-center transition-all duration-200 cursor-pointer rounded-xl ${
                              isWished
                                ? "bg-red-950/80 text-red-400 border border-red-500/30"
                                : "bg-white/5 text-white/70 hover:bg-white hover:text-black"
                            }`}
                            title={isWished ? "Remove from wishlist" : "Add to wishlist"}
                          >
                            <Heart className="w-4 h-4" fill={isWished ? "currentColor" : "none"} />
                          </button>

                          <a
                            href={directLink}
                            target={deal ? "_blank" : undefined}
                            rel={deal ? "noopener noreferrer" : undefined}
                            className="font-sans text-xs font-semibold bg-white text-black hover:bg-white/90 px-4 py-2.5 transition-all duration-200 rounded-xl leading-none block text-center cursor-pointer shadow-md"
                          >
                            {deal ? "Buy Now" : "View Details"}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-[#121217]/50 rounded-2xl p-8 flex items-center justify-center font-sans text-xs text-white/40 h-full">
                  No featured game metadata available
                </div>
              )}

              {/* Right Grid of 6 Cards (Larger Vertical Padding & Cards) */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4.5">
                {gridGames.length > 0 ? (
                  gridGames.map((game) => {
                    const deal = getFeaturedDeal(game);
                    const badge = getCategoryBadge(game.category, game.title);
                    const hasDiscount = deal && deal.discountPercent > 0;
                    const isVN = badge === "Visual Novel";
                    const badgeBg = isVN ? "bg-purple-950/80 text-purple-200 border-purple-400/30" : "bg-red-950/80 text-red-200 border-red-400/30";
                    const isInGridCart = cartItems.some(i => i.gameId === game.id);

                    return (
                      <a
                        key={game.id}
                        href={`/game/${game.slug}`}
                        className="bg-[#121217]/90 hover:bg-[#181820] rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 group border border-white/[0.04] hover:border-white/15 h-full relative"
                      >
                        <div className="space-y-3">
                          {/* Thumbnail with aspect ratio */}
                          <div className="relative aspect-video w-full bg-neutral-900 rounded-xl overflow-hidden shrink-0">
                            <HoverTrailer
                              trailerUrl={game.trailerUrl}
                              coverUrl={getLandscapeImage(game)}
                              altText={game.title}
                              aspectClass="w-full h-full"
                            />
                            {badge && (
                              <span className={`absolute top-2 left-2 font-sans text-[9px] font-medium px-1.5 py-0.5 z-10 rounded-md backdrop-blur-md border ${badgeBg}`}>
                                {badge}
                              </span>
                            )}
                            {game.rating && (
                              <span className="absolute bottom-2 left-2 font-sans text-[9px] font-semibold bg-black/80 text-amber-400 backdrop-blur-md border border-white/15 px-1.5 py-0.5 z-10 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" /> {(game.rating / 10).toFixed(1)}
                              </span>
                            )}

                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isInGridCart) {
                                  await removeFromCart(game.id);
                                } else {
                                  const gameMock = {
                                    id: game.id,
                                    title: game.title,
                                    slug: game.slug,
                                    coverUrl: game.coverUrl,
                                    priceSnapshots: game.priceSnapshots || (deal ? [deal] : []),
                                  };
                                  await addToCart(gameMock);
                                }
                              }}
                              title={isInGridCart ? "Remove from cart" : "Add to cart"}
                              className={`absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none md:opacity-0 group-hover:opacity-100 ${
                                isInGridCart
                                  ? "bg-purple-600 text-white opacity-100"
                                  : "bg-black/70 text-white/80 hover:bg-white hover:text-black"
                              }`}
                            >
                              {isInGridCart ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : (
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                                </svg>
                              )}
                            </button>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-sans text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-white/90 transition-colors">
                              {cleanTitle(game.title)}
                            </h4>
                            <span className="font-sans text-xs text-white/45 block font-normal">
                              by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
                            </span>
                          </div>
                        </div>

                        {/* Footer info & pricing */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.04] font-sans text-xs shrink-0">
                          <PlatformLogos platformNames={game.platformNames} />
                          
                          <div className="flex items-center gap-1.5 font-semibold">
                            {deal ? (
                              <>
                                {hasDiscount && (
                                  <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
                                    -{deal.discountPercent}%
                                  </span>
                                )}
                                <span className="text-emerald-400 text-xs sm:text-sm font-sans font-bold">
                                  {formatPrice(deal.dealPrice, deal.currency)}
                                </span>
                              </>
                            ) : (
                              <span className="text-white/30 text-xs font-normal">—</span>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })
                ) : (
                  <div className="col-span-3 bg-[#121217]/40 rounded-2xl p-10 flex items-center justify-center font-sans text-xs text-white/30">
                    No additional games found
                  </div>
                )}
              </div>

            </div>

            {/* Bottom View All Link Row */}
            <div className="relative z-10 flex justify-end pt-6 mt-6 border-t border-white/[0.04]">
              <button
                onClick={handleBrowseAllClick}
                className="font-sans text-xs font-semibold tracking-wide text-white/80 hover:text-white bg-white/[0.05] hover:bg-white/10 px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-2 border border-white/10 hover:border-white/25"
              >
                <span>
                  {activeTab === "upcoming" ? "View Release Calendar" : `Browse All ${tabs[activeTab].label}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
