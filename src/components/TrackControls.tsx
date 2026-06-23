"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Heart } from "lucide-react";

interface TrackControlsProps {
  gameId: string;
  gameSlug: string;
  initialWishlisted?: boolean;
  initialCollectionStatus?: string | null;
}

export default function TrackControls({
  gameId,
  gameSlug,
  initialWishlisted = false,
  initialCollectionStatus = null,
}: TrackControlsProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [collectionStatus, setCollectionStatus] = useState<string | null>(initialCollectionStatus);
  const [loading, setLoading] = useState(false);

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
          }
        }
      } catch (err) {
        console.error("Failed to fetch game user status:", err);
      }
    }

    fetchStatus();
  }, [gameId, user]);

  const handleAuthRedirect = () => {
    router.push(`/login?redirect=${encodeURIComponent(`/game/${gameSlug}`)}`);
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
        setWishlisted(!wishlisted);
        router.refresh();
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
        setCollectionStatus(isCurrent ? null : status);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to update collection:", err);
    } finally {
      setLoading(false);
    }
  };

  const statuses = [
    { label: "Playing", value: "PLAYING" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Plan to Play", value: "WANT_TO_PLAY" },
    { label: "Owned", value: "OWNED" },
  ];

  return (
    <div className="border border-white p-5 bg-black text-xs flex flex-col justify-between h-full gap-4 min-h-[140px] md:min-h-0 flex-1">
      <div className="space-y-4 flex-1 flex flex-col justify-between">
        <div>
          <span className="font-sans text-[10px] text-white/50 tracking-wider block border-b border-white/20 pb-1.5 uppercase font-black">
            Library Tracker
          </span>
        </div>

        <div className="flex flex-col gap-5 my-auto">
          {/* Wishlist Button */}
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-[9px] text-white/50 font-black uppercase tracking-wider">
              Favorites
            </span>
            <button
              onClick={toggleWishlist}
              disabled={loading}
              className={`flex items-center justify-center gap-2 px-4 py-2 border font-bold uppercase transition-all duration-150 cursor-pointer h-[38px] select-none rounded-none text-[10px] sm:text-xs w-full sm:w-fit ${
                wishlisted
                  ? "bg-white text-black border-white"
                  : "bg-black text-white border-white hover:bg-white hover:text-black"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-black text-black" : "fill-transparent text-white"}`} />
              <span>{wishlisted ? "[ Wishlisted ]" : "[ Add to Wishlist ]"}</span>
            </button>
          </div>

          {/* Collection Tracker */}
          <div className="flex flex-col gap-1.5 w-full">
            <span className="font-sans text-[9px] text-white/50 font-black uppercase tracking-wider">
              Play Status
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {statuses.map((s) => {
                const active = collectionStatus === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => handleStatusClick(s.value)}
                    disabled={loading}
                    className={`py-2 px-1 text-center font-bold text-[9px] uppercase tracking-wider transition-all duration-150 border cursor-pointer truncate h-[38px] flex items-center justify-center rounded-none ${
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
        </div>
      </div>
      
      {!user && (
        <span className="font-sans text-[9px] text-white/40 block mt-2">
          * Sign in to save this game to your library.
        </span>
      )}
    </div>
  );
}
