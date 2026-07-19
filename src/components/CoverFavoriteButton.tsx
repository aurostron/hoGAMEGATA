"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { Heart } from "lucide-react";

interface CoverFavoriteButtonProps {
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  initialWishlisted?: boolean;
}

function CoverFavoriteButtonInner({
  gameId,
  gameSlug,
  gameTitle,
  initialWishlisted = false,
}: CoverFavoriteButtonProps) {
  const { user } = useAuth();
  const [wishlisted, setWishlisted] = useState<boolean>(initialWishlisted);
  const [loading, setLoading] = useState<boolean>(false);
  const [pulse, setPulse] = useState<boolean>(false);

  // Sync from DB on mount if logged in
  useEffect(() => {
    if (!user) return;
    fetch(`/api/user/status?gameId=${gameId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.status) setWishlisted(!!data.status.wishlisted);
      })
      .catch(() => {});
  }, [gameId, user]);

  const handleAuthRedirect = () => {
    window.location.assign(`/login?redirect=${encodeURIComponent(`/game/${gameSlug}`)}`);
  };

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
        const next = !wishlisted;
        setWishlisted(next);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);

        // Sync localStorage
        const libRaw = localStorage.getItem("gamegata_library");
        const library = libRaw ? JSON.parse(libRaw) : {};
        const existing = library[gameId] || {
          gameId, gameTitle, gameSlug,
          wishlisted: false, status: null, rating: null, updatedAt: Date.now(),
        };
        existing.wishlisted = next;
        existing.updatedAt = Date.now();
        library[gameId] = existing;
        localStorage.setItem("gamegata_library", JSON.stringify(library));
      }
    } catch (err) {
      console.error("Failed to toggle wishlist:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={wishlisted ? "Remove from Favorites" : "Add to Favorites"}
      className={`
        absolute top-3 right-3 z-20
        w-9 h-9 rounded-xl
        flex items-center justify-center
        backdrop-blur-md
        border transition-all duration-200
        ${wishlisted
          ? "bg-white/20 border-white/30 shadow-lg"
          : "bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/30"
        }
        ${pulse ? "scale-125" : "scale-100"}
        cursor-pointer select-none
      `}
    >
      <Heart
        className={`w-4 h-4 transition-all duration-200 ${
          wishlisted
            ? "fill-white text-white"
            : "fill-transparent text-white/70 hover:text-white"
        }`}
        strokeWidth={2}
      />
    </button>
  );
}

export default function CoverFavoriteButton(props: CoverFavoriteButtonProps) {
  return (
    <AuthProvider>
      <CoverFavoriteButtonInner {...props} />
    </AuthProvider>
  );
}
