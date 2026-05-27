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
    { label: "PLAYING", value: "PLAYING" },
    { label: "COMPLETED", value: "COMPLETED" },
    { label: "WANT TO PLAY", value: "WANT_TO_PLAY" },
    { label: "OWNED", value: "OWNED" },
  ];

  return (
    <div className="border border-white p-5 space-y-4 bg-black font-mono text-xs">
      <span className="font-mono text-[9px] text-white/50 tracking-widest block border-b border-white/20 pb-1 uppercase font-bold">
        Personal Tracking Index
      </span>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Wishlist Button */}
        <button
          onClick={toggleWishlist}
          disabled={loading}
          className={`flex items-center justify-center gap-2 px-4 py-2 border font-bold uppercase transition-all duration-150 cursor-pointer ${
            wishlisted
              ? "bg-white text-black border-white"
              : "bg-black text-white border-white hover:bg-white hover:text-black"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-black text-black" : "fill-transparent text-white"}`} />
          <span>{wishlisted ? "[ In Wishlist ]" : "[ Add to Wishlist ]"}</span>
        </button>

        {/* Collection Tracker */}
        <div className="flex flex-col gap-1.5 flex-1 max-w-lg">
          <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider">Gameplay Status:</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {statuses.map((s) => {
              const active = collectionStatus === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => handleStatusClick(s.value)}
                  disabled={loading}
                  className={`py-1.5 px-1 text-center font-bold text-[9px] uppercase tracking-wider transition-all duration-150 border cursor-pointer truncate ${
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
      
      {!user && (
        <span className="text-[9px] text-white/40 block mt-1">
          * Sign in required to save tracking configurations to your terminal.
        </span>
      )}
    </div>
  );
}
