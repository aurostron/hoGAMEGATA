"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CartProvider, useCart } from "../context/CartContext";
import { Heart, Check } from "lucide-react";

interface TrackControlsProps {
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  genres: string[];
  siteRating: number | null;
  steamRating: number | null;
  initialWishlisted?: boolean;
  initialCollectionStatus?: string | null;
  coverUrl?: string | null;
  initialPriceSnapshots?: any[];
}

interface JournalItem {
  gameId: string;
  gameTitle: string;
  action: string;
  value: string;
  timestamp: number;
}

function TrackControlsInner({
  gameId,
  gameSlug,
  gameTitle,
  genres = [],
  siteRating = null,
  steamRating = null,
  initialWishlisted = false,
  initialCollectionStatus = null,
  coverUrl = null,
  initialPriceSnapshots = [],
}: TrackControlsProps) {
  const { user } = useAuth();
  const { cartItems, addToCart, removeFromCart } = useCart();
  const isInCart = cartItems.some(item => item.gameId === gameId);

  const handleCartToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      await removeFromCart(gameId);
    } else {
      const gameMock = {
        id: gameId,
        title: gameTitle,
        slug: gameSlug,
        coverUrl,
        priceSnapshots: initialPriceSnapshots,
      };
      await addToCart(gameMock);
      window.dispatchEvent(new Event("gamegata_open_cart"));
    }
  };

  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [collectionStatus, setCollectionStatus] = useState<string | null>(initialCollectionStatus);
  const [loading, setLoading] = useState(false);

  // Client-side states
  const [mounted, setMounted] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [history, setHistory] = useState<JournalItem[]>([]);
  const [similarStats, setSimilarStats] = useState<{
    count: number;
    avgRating: number | null;
  } | null>(null);

  // Sync with DB on mount / user change
  useEffect(() => {
    if (!user) {
      setWishlisted(false);
      setCollectionStatus(null);
      return;
    }

    async function fetchStatus() {
      try {
        const response = await fetch(`/api/user/game-status?gameId=${gameId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.loggedIn) {
            setWishlisted(data.wishlisted);
            setCollectionStatus(data.collectionStatus);

            // Sync to local storage library map
            const libRaw = localStorage.getItem("gamegata_library");
            const library = libRaw ? JSON.parse(libRaw) : {};
            const existing = library[gameId] || {
              gameId,
              gameTitle,
              gameSlug,
              genres,
              wishlisted: data.wishlisted,
              status: data.collectionStatus,
              rating: null,
              updatedAt: Date.now()
            };
            let changed = false;
            if (existing.wishlisted !== data.wishlisted) {
              existing.wishlisted = data.wishlisted;
              changed = true;
            }
            if (existing.status !== data.collectionStatus) {
              existing.status = data.collectionStatus;
              changed = true;
            }
            if (changed) {
              library[gameId] = existing;
              localStorage.setItem("gamegata_library", JSON.stringify(library));
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch game user status:", err);
      }
    }

    fetchStatus();
  }, [gameId, user]);

  // Load client-only localStorage states
  useEffect(() => {
    setMounted(true);

    const libRaw = localStorage.getItem("gamegata_library");
    const library = libRaw ? JSON.parse(libRaw) : {};

    // Get current game's rating
    if (library[gameId]) {
      setRating(library[gameId].rating || null);
    } else {
      setRating(null);
    }

    // Get activity history for this game
    const journalRaw = localStorage.getItem("gamegata_journal");
    const journal = journalRaw ? JSON.parse(journalRaw) : [];
    const gameHistory = journal.filter((item: JournalItem) => item.gameId === gameId);
    setHistory(gameHistory);

    // Compute stats for similar games
    const otherGames = Object.values(library).filter(
      (item: any) => item.gameId !== gameId
    );
    const similarGames = otherGames.filter((item: any) => {
      const itemGenres = item.genres || [];
      return itemGenres.some((g: string) => genres.includes(g));
    });

    const ratedSimilar = similarGames.filter((item: any) => item.rating !== null);
    const avg = ratedSimilar.length > 0
      ? ratedSimilar.reduce((acc: number, cur: any) => acc + (cur.rating || 0), 0) / ratedSimilar.length
      : null;

    setSimilarStats({
      count: similarGames.length,
      avgRating: avg,
    });
  }, [gameId, wishlisted, collectionStatus]);

  const handleAuthRedirect = () => {
    window.location.assign(`/login?redirect=${encodeURIComponent(`/game/${gameSlug}`)}`);
  };

  const toggleWishlist = async () => {
    if (!user) {
      handleAuthRedirect();
      return;
    }

    setLoading(true);
    const method = wishlisted ? "DELETE" : "POST";
    try {
      const res = await fetch("/api/user/wishlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const nextWishlisted = !wishlisted;
        setWishlisted(nextWishlisted);

        // Update local library
        const libRaw = localStorage.getItem("gamegata_library");
        const library = libRaw ? JSON.parse(libRaw) : {};
        const existing = library[gameId] || {
          gameId,
          gameTitle,
          gameSlug,
          genres,
          wishlisted: false,
          status: collectionStatus,
          rating: null,
          updatedAt: Date.now()
        };
        existing.wishlisted = nextWishlisted;
        existing.updatedAt = Date.now();
        library[gameId] = existing;
        localStorage.setItem("gamegata_library", JSON.stringify(library));

        // Add log entry
        const journalRaw = localStorage.getItem("gamegata_journal");
        const journal = journalRaw ? JSON.parse(journalRaw) : [];
        const entry: JournalItem = {
          gameId,
          gameTitle,
          action: "wishlist",
          value: nextWishlisted ? "Added to Favorites" : "Removed from Favorites",
          timestamp: Date.now()
        };
        journal.unshift(entry);
        localStorage.setItem("gamegata_journal", JSON.stringify(journal.slice(0, 100)));

        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to update wishlist:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusClick = async (status: string) => {
    if (!user) {
      handleAuthRedirect();
      return;
    }

    setLoading(true);
    const isCurrent = collectionStatus === status;
    const method = isCurrent ? "DELETE" : "POST";
    try {
      const res = await fetch("/api/user/collection", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, status }),
      });
      if (res.ok) {
        const nextStatus = isCurrent ? null : status;
        setCollectionStatus(nextStatus);

        // Update local library
        const libRaw = localStorage.getItem("gamegata_library");
        const library = libRaw ? JSON.parse(libRaw) : {};
        const existing = library[gameId] || {
          gameId,
          gameTitle,
          gameSlug,
          genres,
          wishlisted,
          status: null,
          rating: null,
          updatedAt: Date.now()
        };
        existing.status = nextStatus;
        existing.updatedAt = Date.now();
        library[gameId] = existing;
        localStorage.setItem("gamegata_library", JSON.stringify(library));

        // Add log entry
        const journalRaw = localStorage.getItem("gamegata_journal");
        const journal = journalRaw ? JSON.parse(journalRaw) : [];
        const statusLabel = statuses.find(s => s.value === status)?.label || status;
        const entry: JournalItem = {
          gameId,
          gameTitle,
          action: "status",
          value: isCurrent ? "Cleared Play Status" : `Set Status to ${statusLabel}`,
          timestamp: Date.now()
        };
        journal.unshift(entry);
        localStorage.setItem("gamegata_journal", JSON.stringify(journal.slice(0, 100)));

        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to update collection:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (newRatingVal: number | null) => {
    setRating(newRatingVal);

    // Save to library
    const libRaw = localStorage.getItem("gamegata_library");
    const library = libRaw ? JSON.parse(libRaw) : {};

    const existing = library[gameId] || {
      gameId,
      gameTitle,
      gameSlug,
      genres,
      wishlisted,
      status: collectionStatus,
      rating: null,
      updatedAt: Date.now()
    };
    existing.rating = newRatingVal;
    existing.updatedAt = Date.now();
    library[gameId] = existing;
    localStorage.setItem("gamegata_library", JSON.stringify(library));

    // Add log entry
    const journalRaw = localStorage.getItem("gamegata_journal");
    const journal = journalRaw ? JSON.parse(journalRaw) : [];
    const actionVal = newRatingVal ? `Rated game ${newRatingVal}/10` : "Removed rating";

    const entry: JournalItem = {
      gameId,
      gameTitle,
      action: "rating",
      value: actionVal,
      timestamp: Date.now()
    };
    journal.unshift(entry);
    localStorage.setItem("gamegata_journal", JSON.stringify(journal.slice(0, 100)));

    // Update history view
    setHistory(journal.filter((item: JournalItem) => item.gameId === gameId));
  };

  const statuses = [
    { label: "Playing", value: "PLAYING" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Plan to Play", value: "WANT_TO_PLAY" },
    { label: "Owned", value: "OWNED" },
  ];

  return (
    <div className="relative border border-white/5 p-5 bg-[#131316]/50 text-xs flex flex-col justify-between h-full gap-5 min-h-[380px] md:min-h-[420px] flex-1 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Background Graphic */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-20 filter blur-[2px] transition-all duration-500 hover:scale-105"
        style={{ backgroundImage: "url('/graphic1.jpg')" }}
      />
      <div className="absolute inset-0 z-0 bg-black/30 pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between h-full gap-5 flex-1">
        {/* 1. Main Header */}
        <div>
          <span className="text-[12px] text-neutral-450 uppercase tracking-widest block border-b border-white/5 pb-2 font-bold">
            My Tracking Journal
          </span>
        </div>

        {/* 2. Controls Grid */}
        <div className="space-y-4">
          {/* Favorite & Cart Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Favorites */}
            <div className="flex flex-col gap-1.5">
              
              <button
                onClick={toggleWishlist}
                disabled={loading}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 border font-semibold transition-all duration-150 cursor-pointer h-[38px] select-none rounded-xl text-xs w-full ${
                  wishlisted
                    ? "bg-white text-black border-white"
                    : "bg-white/5 text-white border-white/10 hover:bg-white hover:text-black"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-black text-black" : "fill-transparent text-white"}`} />
                <span>{wishlisted ? "Favorited" : "Favorite"}</span>
              </button>
            </div>

            {/* Shopping Cart */}
            <div className="flex flex-col gap-1.5">
            
              <button
                onClick={handleCartToggle}
                disabled={loading}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 border font-semibold transition-all duration-150 cursor-pointer h-[38px] select-none rounded-xl text-xs w-full ${
                  isInCart
                    ? "bg-emerald-600/90 text-white border-emerald-600/10"
                    : "bg-white/5 text-white border-white/10 hover:bg-white hover:text-black"
                }`}
              >
                {isInCart ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>In Cart</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    <span>Add to Cart</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Play Status */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-neutral-450 font-semibold uppercase tracking-wider">
              My Progress
            </span>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map((s) => {
                const active = collectionStatus === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => handleStatusClick(s.value)}
                    disabled={loading}
                    className={`py-2 px-1 text-center font-medium text-[11px] transition-all duration-150 border cursor-pointer truncate h-[34px] flex items-center justify-center rounded-xl ${
                      active
                        ? "bg-white text-black border-white font-semibold"
                        : "bg-white/5 text-white border-white/5 hover:bg-white hover:text-black"
                    }`}
                  >
                    {active ? `✓ ${s.label}` : s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal Rating */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-neutral-450 font-semibold uppercase tracking-wider">
              My Rating
            </span>
            <select
              value={rating || ""}
              onChange={(e) => {
                const val = e.target.value;
                handleRatingChange(val ? parseInt(val) : null);
              }}
              className="bg-white/5 text-white border border-white/10 p-2 text-xs font-medium w-full rounded-xl focus:outline-none cursor-pointer h-[38px] focus:border-white/30"
            >
              <option value="" className="bg-zinc-950">Select Rating</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num} className="bg-zinc-950">
                  {num} / 10
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Comparison Stats */}
        <div className="border-t border-white/5 pt-4 flex flex-col gap-1">
          <span className="text-[10px] text-neutral-455 font-bold uppercase tracking-widest mb-1">
            Comparison to Similar Games
          </span>
          {mounted && similarStats ? (
            <div className="space-y-1.5 text-neutral-350 font-mono text-[10px] uppercase">
              <div>
                • Similar Genres: <span className="text-white font-medium">{genres.slice(0, 2).join(", ") || "None"}</span>
              </div>
              <div>
                • Games Played/Rated: <span className="text-white font-medium">{similarStats.count}</span>
              </div>
              {similarStats.avgRating !== null ? (
                <div>
                  • Your Average: <span className="text-white font-medium">{similarStats.avgRating.toFixed(1)}/10</span>
                  {rating !== null && (
                    <span className="text-white/40 ml-1.5">
                      ({rating > similarStats.avgRating ? "+" : ""}{(rating - similarStats.avgRating).toFixed(1)} vs avg)
                    </span>
                  )}
                </div>
              ) : (
                <div>
                  • Your Average: <span className="text-white/30 italic">N/A</span>
                </div>
              )}
              {siteRating !== null && (
                <div>
                  • Site Average: <span className="text-white font-medium">{siteRating.toFixed(1)}/10</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-white/30 italic text-[10px] uppercase font-mono">[ Loading Stats... ]</span>
          )}
        </div>

        {/* 4. Play History Log */}
        <div className="border-t border-white/5 pt-4 flex-1 flex flex-col gap-1">
          <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mb-1">
            Activity Log
          </span>
          <div className="space-y-2 overflow-y-auto max-h-[85px] pr-1 scrollbar-thin">
            {mounted ? (
              history.length > 0 ? (
                history.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline text-[9px] font-mono text-neutral-350 uppercase">
                    <span className="truncate max-w-[170px]">{item.value}</span>
                    <span className="text-white/30 shrink-0 text-[8px] ml-1">
                      {new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-white/35 italic text-[9px] uppercase font-mono block">No activity logged yet.</span>
              )
            ) : (
              <span className="text-white/35 italic text-[9px] uppercase font-mono block">[ Loading Log... ]</span>
            )}
          </div>
        </div>

        {/* Footer Info */}
        {!user && (
          <span className="text-[12px] text-white/55 block border-t border-white/5 pt-2 leading-snug">
            * Sign in to sync your status to the server database.
          </span>
        )}
      </div>
    </div>
  );
}

export default function TrackControls(props: TrackControlsProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <TrackControlsInner {...props} />
      </CartProvider>
    </AuthProvider>
  );
}
