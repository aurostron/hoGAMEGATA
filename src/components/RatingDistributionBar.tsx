"use client";

import React, { useState, useEffect } from "react";
import { ThumbsUp, Smile, Meh, Minus, Check } from "lucide-react";

interface RatingDistributionBarProps {
  gameId: string;
  gameTitle: string;
  baseRating?: number | null; // 0 - 100 score
}

type RatingType = "exceptional" | "recommended" | "meh" | "skip";

interface RatingData {
  exceptional: number;
  recommended: number;
  meh: number;
  skip: number;
}

export default function RatingDistributionBar({
  gameId,
  gameTitle,
  baseRating = 80,
}: RatingDistributionBarProps) {
  const [userRating, setUserRating] = useState<RatingType | null>(null);
  const [hoveredRating, setHoveredRating] = useState<RatingType | null>(null);

  // Deterministic baseline counts based on baseRating & gameId
  const seed = (gameId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 30) + 5;
  const ratingScore = baseRating || 80;

  let baseExceptional = Math.round((ratingScore > 85 ? 18 : ratingScore > 75 ? 8 : 2) + (seed % 4));
  let baseRecommended = Math.round((ratingScore > 70 ? 32 : 15) + (seed % 8));
  let baseMeh = Math.round((ratingScore < 75 ? 12 : 5) + (seed % 4));
  let baseSkip = Math.round((ratingScore < 65 ? 15 : 4) + (seed % 3));

  const [counts, setCounts] = useState<RatingData>({
    exceptional: baseExceptional,
    recommended: baseRecommended,
    meh: baseMeh,
    skip: baseSkip,
  });

  // Load user vote from localStorage
  useEffect(() => {
    try {
      const savedVote = localStorage.getItem(`gamegata_rating_${gameId}`) as RatingType | null;
      if (savedVote && ["exceptional", "recommended", "meh", "skip"].includes(savedVote)) {
        setUserRating(savedVote);
        setCounts((prev) => ({
          ...prev,
          [savedVote]: prev[savedVote] + 1,
        }));
      }
    } catch (e) {
      /* ignore */
    }
  }, [gameId]);

  const handleRate = (type: RatingType) => {
    let newCounts = { ...counts };

    if (userRating) {
      newCounts[userRating] = Math.max(0, newCounts[userRating] - 1);
    }

    if (userRating === type) {
      setUserRating(null);
      localStorage.removeItem(`gamegata_rating_${gameId}`);
    } else {
      setUserRating(type);
      newCounts[type] = newCounts[type] + 1;
      localStorage.setItem(`gamegata_rating_${gameId}`, type);
    }

    setCounts(newCounts);
  };

  const totalVotes = counts.exceptional + counts.recommended + counts.meh + counts.skip;
  const pctExceptional = totalVotes > 0 ? (counts.exceptional / totalVotes) * 100 : 15;
  const pctRecommended = totalVotes > 0 ? (counts.recommended / totalVotes) * 100 : 50;
  const pctMeh = totalVotes > 0 ? (counts.meh / totalVotes) * 100 : 20;
  const pctSkip = totalVotes > 0 ? (counts.skip / totalVotes) * 100 : 15;

  const categories = [
    {
      id: "exceptional" as RatingType,
      label: "Exceptional",
      bgGradient: "bg-gradient-to-r from-[#86efac] to-[#4ade80]",
      dotColor: "bg-[#4ade80]",
      icon: ThumbsUp,
      pct: pctExceptional,
      count: counts.exceptional,
    },
    {
      id: "recommended" as RatingType,
      label: "Recommended",
      bgGradient: "bg-gradient-to-r from-[#3b82f6] to-[#2563eb]",
      dotColor: "bg-[#3b82f6]",
      icon: ThumbsUp,
      pct: pctRecommended,
      count: counts.recommended,
    },
    {
      id: "meh" as RatingType,
      label: "Meh",
      bgGradient: "bg-gradient-to-r from-[#f59e0b] to-[#d97706]",
      dotColor: "bg-[#f59e0b]",
      icon: Meh,
      pct: pctMeh,
      count: counts.meh,
    },
    {
      id: "skip" as RatingType,
      label: "Skip",
      bgGradient: "bg-gradient-to-r from-[#ef4444] to-[#dc2626]",
      dotColor: "bg-[#ef4444]",
      icon: Minus,
      pct: pctSkip,
      count: counts.skip,
    },
  ];

  return (
    <div className="border border-white/10 bg-[#131316]/60 backdrop-blur-md p-3.5 rounded-2xl shadow-xl space-y-2.5 select-none font-sans">
      {/* Header Label */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400 font-semibold tracking-wide">
          {userRating ? "Your Rating:" : "Click to rate"}
        </span>
        {userRating && (
          <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {userRating}
          </span>
        )}
      </div>

      {/* Compact Segmented Rating Bar */}
      <div className="h-9 sm:h-10 w-full rounded-xl overflow-hidden flex bg-black/40 border border-white/10 relative p-0.5 gap-0.5 shadow-inner">
        {categories.map((cat) => {
          if (cat.pct <= 0) return null;
          const isSelected = userRating === cat.id;
          const isHovered = hoveredRating === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => handleRate(cat.id)}
              onMouseEnter={() => setHoveredRating(cat.id)}
              onMouseLeave={() => setHoveredRating(null)}
              style={{ width: `${cat.pct}%` }}
              className={`h-full ${cat.bgGradient} transition-all duration-200 cursor-pointer relative group flex items-center justify-center overflow-hidden ${
                isSelected ? "ring-2 ring-white z-10 brightness-110" : ""
              } ${isHovered ? "brightness-125 scale-y-105" : "opacity-95 hover:opacity-100"}`}
              title={`${cat.label}: ${cat.pct.toFixed(0)}% (${cat.count} votes)`}
            >
              {/* Segment Icon */}
              {cat.pct > 10 && (
                <div className="flex items-center justify-center p-0.5 bg-black/20 rounded-full text-white shadow-xs">
                  <cat.icon className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend Row */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-xs">
        {categories.map((cat) => {
          const isSelected = userRating === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => handleRate(cat.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? "bg-white/15 border border-white/30 text-white font-bold"
                  : "bg-white/5 border border-transparent text-neutral-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cat.dotColor} shrink-0`} />
              <span className="font-bold">{cat.label}</span>
              <span className="font-mono text-xs text-neutral-400 font-semibold">
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
