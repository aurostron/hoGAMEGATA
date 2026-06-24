"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { Heart } from "lucide-react";

interface TrackControlsProps {
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  genres: string[];
  siteRating: number | null;
  steamRating: number | null;
  initialWishlisted?: boolean;
  initialCollectionStatus?: string | null;
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
}: TrackControlsProps) {
  const { user } = useAuth();

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
    <div className="border border-white p-5 bg-black text-xs flex flex-col justify-between h-full gap-5 min-h-[380px] md:min-h-[420px] flex-1">
      {/* 1. Main Header */}
      <div>
        <span className="font-sans text-[11px] text-white/50 tracking-widest block border-b border-white/20 pb-1.5 uppercase font-extrabold">
          My Tracking Journal
        </span>
      </div>

      {/* 2. Controls Grid */}
      <div className="space-y-4">
        {/* Favorites */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[10px] text-white/40 font-bold uppercase tracking-wider">
            Favorite Status
          </span>
          <button
            onClick={toggleWishlist}
            disabled={loading}
            className={`flex items-center justify-center gap-2 px-4 py-2 border font-bold uppercase transition-all duration-150 cursor-pointer h-[38px] select-none rounded-none text-[10px] sm:text-xs w-full ${
              wishlisted
                ? "bg-white text-black border-white"
                : "bg-black text-white border-white hover:bg-white hover:text-black"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-black text-black" : "fill-transparent text-white"}`} />
            <span>{wishlisted ? "Favorited" : "Add to Favorites"}</span>
          </button>
        </div>

        {/* Play Status */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[10px] text-white/40 font-bold uppercase tracking-wider">
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
                  className={`py-2 px-1 text-center font-bold text-[9px] uppercase tracking-wider transition-all duration-150 border cursor-pointer truncate h-[34px] flex items-center justify-center rounded-none ${
                    active
                      ? "bg-white text-black border-white"
                      : "bg-black text-white border-white hover:bg-white hover:text-black"
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
          <span className="font-sans text-[10px] text-white/40 font-bold uppercase tracking-wider">
            My Rating
          </span>
          <select
            value={rating || ""}
            onChange={(e) => {
              const val = e.target.value;
              handleRatingChange(val ? parseInt(val) : null);
            }}
            className="bg-black text-white border border-white p-2 text-xs font-bold uppercase w-full rounded-none focus:outline-none cursor-pointer h-[38px]"
          >
            <option value="">[ Select Rating ]</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num} / 10
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Comparison Stats */}
      <div className="border-t border-white/20 pt-4 flex flex-col gap-1">
        <span className="font-sans text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">
          Comparison to Similar Games
        </span>
        {mounted && similarStats ? (
          <div className="space-y-1.5 text-white/80 font-mono text-[10px] uppercase">
            <div>
              • Similar Genres: <span className="text-white font-bold">{genres.slice(0, 2).join(", ") || "None"}</span>
            </div>
            <div>
              • Games Played/Rated: <span className="text-white font-bold">{similarStats.count}</span>
            </div>
            {similarStats.avgRating !== null ? (
              <div>
                • Your Average: <span className="text-white font-bold">{similarStats.avgRating.toFixed(1)}/10</span>
                {rating !== null && (
                  <span className="text-white/50 ml-1.5">
                    ({rating > similarStats.avgRating ? "+" : ""}{(rating - similarStats.avgRating).toFixed(1)} vs avg)
                  </span>
                )}
              </div>
            ) : (
              <div>
                • Your Average: <span className="text-white/40 italic">N/A</span>
              </div>
            )}
            {siteRating !== null && (
              <div>
                • Site Average: <span className="text-white font-bold">{siteRating.toFixed(1)}/10</span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-white/30 italic text-[10px] uppercase font-mono">[ Loading Stats... ]</span>
        )}
      </div>

      {/* 4. Play History Log */}
      <div className="border-t border-white/20 pt-4 flex-1 flex flex-col gap-1">
        <span className="font-sans text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">
          Activity Log
        </span>
        <div className="space-y-2 overflow-y-auto max-h-[85px] pr-1 scrollbar-thin">
          {mounted ? (
            history.length > 0 ? (
              history.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between items-baseline text-[9px] font-mono text-white/70 uppercase">
                  <span className="truncate max-w-[170px]">{item.value}</span>
                  <span className="text-white/40 shrink-0 text-[8px] ml-1">
                    {new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-white/30 italic text-[9px] uppercase font-mono block">No activity logged yet.</span>
            )
          ) : (
            <span className="text-white/30 italic text-[9px] uppercase font-mono block">[ Loading Log... ]</span>
          )}
        </div>
      </div>

      {/* Footer Info */}
      {!user && (
        <span className="font-sans text-[9px] text-white/30 block border-t border-white/10 pt-2 leading-snug">
          * Sign in to sync your status to the server database.
        </span>
      )}
    </div>
  );
}

export default function TrackControls(props: TrackControlsProps) {
  return (
    <AuthProvider>
      <TrackControlsInner {...props} />
    </AuthProvider>
  );
}
