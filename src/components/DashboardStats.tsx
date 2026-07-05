"use client";

import { useState, useEffect } from "react";
import { Library, CheckCircle2, Clock, Flame } from "lucide-react";

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

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startValue = displayValue;
    const endValue = value;
    if (startValue === endValue) return;

    const duration = 800; // snappier 800ms
    const startTime = performance.now();
    let animationFrameId: number;

    const updateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad
      const current = Math.round(startValue + easeProgress * (endValue - startValue));
      
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value]);

  return <>{displayValue}</>;
}

export default function DashboardStats({ wishlist, collection }: DashboardStatsProps) {
  // Active filters for stats calculation
  const [activeFilters, setActiveFilters] = useState<string[]>([
    "wishlist",
    "PLAYING",
    "COMPLETED",
    "WANT_TO_PLAY",
    "OWNED"
  ]);

  const [mounted, setMounted] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Toggle category filters
  const toggleFilter = (filter: string) => {
    if (activeFilters.includes(filter)) {
      // Keep at least one filter active so calculation is valid
      if (activeFilters.length > 1) {
        setActiveFilters(activeFilters.filter(f => f !== filter));
      }
    } else {
      setActiveFilters([...activeFilters, filter]);
    }
  };

  // 1. Calculate static overview stats
  const totalUniqueGamesMap = new Map<string, Game>();
  wishlist.forEach(g => totalUniqueGamesMap.set(g.id, g));
  collection.forEach(c => totalUniqueGamesMap.set(c.game.id, c.game));
  const totalTrackedGames = totalUniqueGamesMap.size;

  const collectionCount = collection.length;
  const completedCount = collection.filter(c => c.status === "COMPLETED").length;
  const completionRate = collectionCount > 0 ? Math.round((completedCount / collectionCount) * 100) : 0;

  const backlogCount = collection.filter(c => c.status === "WANT_TO_PLAY" || c.status === "PLAYING").length;

  // 2. Parse genres based on active filters
  const filteredGames: Game[] = [];
  const seenIds = new Set<string>();

  if (activeFilters.includes("wishlist")) {
    wishlist.forEach(g => {
      if (!seenIds.has(g.id)) {
        seenIds.add(g.id);
        filteredGames.push(g);
      }
    });
  }

  collection.forEach(item => {
    if (activeFilters.includes(item.status)) {
      if (!seenIds.has(item.game.id)) {
        seenIds.add(item.game.id);
        filteredGames.push(item.game);
      }
    }
  });

  const genreCounts: { [key: string]: number } = {};
  filteredGames.forEach(game => {
    if (game.genreNames) {
      const parts = game.genreNames.split(",").map(g => g.trim());
      parts.forEach(genre => {
        if (genre) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      });
    } else {
      genreCounts["Horror"] = (genreCounts["Horror"] || 0) + 1;
    }
  });

  const sortedGenres = Object.entries(genreCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topGenreName = sortedGenres[0]?.name || "N/A";
  const totalGenreOccurrences = sortedGenres.reduce((acc, curr) => acc + curr.count, 0);

  // 3. Build SVG Doughnut Segment Data
  const topGenres = sortedGenres.slice(0, 5);
  const otherGenresCount = sortedGenres.slice(5).reduce((acc, curr) => acc + curr.count, 0);
  const chartData = [...topGenres];
  if (otherGenresCount > 0) {
    chartData.push({ name: "Other Genres", count: otherGenresCount });
  }

  const colors = [
    "#f43f5e", // Rose (primary horror accent)
    "#a855f7", // Violet
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#0ea5e9", // Sky
    "#6b7280", // Slate (for other)
  ];

  const radius = 50;
  const C = 2 * Math.PI * radius; // ~314.159
  let accumulatedPercentage = 0;

  const segments = chartData.map((data, index) => {
    const pct = totalGenreOccurrences > 0 ? data.count / totalGenreOccurrences : 0;
    const strokeLength = pct * C;
    const startOffset = -accumulatedPercentage * C;
    accumulatedPercentage += pct;
    return {
      ...data,
      pct,
      strokeLength,
      startOffset,
      color: colors[index % colors.length]
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left Columns: Stats Grid and Controls */}
      <div className="md:col-span-2 space-y-6">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1: Total Tracked */}
          <div className="border border-white/5 bg-[#131316]/50 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-neutral-450 uppercase tracking-widest font-semibold">Library Size</span>
            </div>
            <div>
              <span className="font-mono text-3xl font-bold text-white"><AnimatedNumber value={totalTrackedGames} /></span>
              <p className="text-[9px] text-neutral-455 mt-1 uppercase font-semibold">Unique horror titles</p>
            </div>
          </div>

          {/* Card 2: Completion Rate */}
          <div className="border border-white/5 bg-[#131316]/50 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-neutral-450 uppercase tracking-widest font-semibold">Completion Rate</span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold text-white"><AnimatedNumber value={completionRate} />%</span>
                <span className="text-[10px] text-neutral-455 font-mono">({completedCount}/{collectionCount})</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-1.5">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-[1000ms]"
                  style={{ width: animated ? `${completionRate}%` : "0%" }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Backlog Status */}
          <div className="border border-white/5 bg-[#131316]/50 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-neutral-450 uppercase tracking-widest font-semibold">Active Backlog</span>
            </div>
            <div>
              <span className="font-mono text-3xl font-bold text-white"><AnimatedNumber value={backlogCount} /></span>
              <p className="text-[9px] text-neutral-455 mt-1 uppercase font-semibold">Playing or planned</p>
            </div>
          </div>

          {/* Card 4: Top Genre */}
          <div className="border border-white/5 bg-[#131316]/50 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-neutral-455 uppercase tracking-widest font-semibold">Favourite theme</span>
            </div>
            <div>
              <span className="text-xl font-bold text-white truncate block">{topGenreName}</span>
              <p className="text-[9px] text-neutral-400 mt-1.5 uppercase font-semibold">Most tracked genre</p>
            </div>
          </div>
        </div>

        {/* Toggle Filter Panel */}
        <div className="border border-white/5 bg-[#131316]/50 p-5 rounded-2xl shadow-xl space-y-4">
          <span className="text-[10px] text-neutral-455 uppercase tracking-widest block font-bold">Filter Genre Distribution</span>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => toggleFilter("wishlist")}
              className={`px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wider rounded-xl border transition-all duration-150 ${
                activeFilters.includes("wishlist")
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white border-white/5 hover:bg-white/10"
              }`}
            >
              Wishlist
            </button>
            <button
              onClick={() => toggleFilter("PLAYING")}
              className={`px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wider rounded-xl border transition-all duration-150 ${
                activeFilters.includes("PLAYING")
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white border-white/5 hover:bg-white/10"
              }`}
            >
              Playing
            </button>
            <button
              onClick={() => toggleFilter("COMPLETED")}
              className={`px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wider rounded-xl border transition-all duration-150 ${
                activeFilters.includes("COMPLETED")
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white border-white/5 hover:bg-white/10"
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => toggleFilter("WANT_TO_PLAY")}
              className={`px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wider rounded-xl border transition-all duration-150 ${
                activeFilters.includes("WANT_TO_PLAY")
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white border-white/5 hover:bg-white/10"
              }`}
            >
              Planned
            </button>
            <button
              onClick={() => toggleFilter("OWNED")}
              className={`px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wider rounded-xl border transition-all duration-150 ${
                activeFilters.includes("OWNED")
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white border-white/5 hover:bg-white/10"
              }`}
            >
              Owned
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Doughnut Chart & Legend */}
      <div className="border border-white/5 bg-[#131316]/50 p-6 rounded-2xl shadow-xl flex flex-col justify-between gap-6">
        <div>
          <span className="text-[10px] text-neutral-455 uppercase tracking-widest block font-bold border-b border-white/5 pb-2">Genre Composition</span>
        </div>

        {filteredGames.length === 0 ? (
          <div className="flex-grow flex items-center justify-center py-12 text-center text-xs text-neutral-500 uppercase tracking-widest font-mono font-bold">
            [ No active filters ]
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-6 py-2 flex-grow">
            {/* SVG Doughnut Chart */}
            <div className="relative w-[150px] h-[150px] shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                {/* Background Track */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#1c1917"
                  strokeWidth="11"
                />
                {/* Interactive Segments */}
                {segments.map((seg, idx) => {
                  const isHovered = hoveredSegment === idx;
                  const dashLength = Math.max(0, seg.strokeLength - 3); // Premium 3px visual gap between segments
                  return (
                    <circle
                      key={idx}
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={isHovered ? "14" : "11"}
                      strokeDasharray={animated ? `${dashLength} ${C}` : `0 ${C}`}
                      strokeDashoffset={seg.startOffset}
                      transform="rotate(-90 60 60)"
                      className="cursor-pointer"
                      style={{
                        filter: isHovered ? "drop-shadow(0px 0px 4px rgba(255,255,255,0.15))" : "none",
                        transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.3s ease"
                      }}
                      onMouseEnter={() => setHoveredSegment(idx)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    />
                  );
                })}

                {/* Center Text (Interactive Tooltip) */}
                {hoveredSegment !== null ? (
                  <>
                    <text
                      x="60"
                      y="54"
                      textAnchor="middle"
                      className="fill-neutral-400 text-[7px] uppercase tracking-widest font-bold"
                    >
                      {segments[hoveredSegment].name.slice(0, 12)}
                      {segments[hoveredSegment].name.length > 12 ? "..." : ""}
                    </text>
                    <text
                      x="60"
                      y="71"
                      textAnchor="middle"
                      className="fill-white text-base font-bold font-mono"
                    >
                      {segments[hoveredSegment].count}
                    </text>
                    <text
                      x="60"
                      y="83"
                      textAnchor="middle"
                      className="fill-neutral-400 text-[8px] font-mono"
                    >
                      {Math.round(segments[hoveredSegment].pct * 100)}%
                    </text>
                  </>
                ) : (
                  <>
                    <text
                      x="60"
                      y="54"
                      textAnchor="middle"
                      className="fill-neutral-400 text-[7px] uppercase tracking-widest font-bold"
                    >
                      Filtered
                    </text>
                    <text
                      x="60"
                      y="72"
                      textAnchor="middle"
                      className="fill-white text-lg font-bold font-mono"
                    >
                      <AnimatedNumber value={filteredGames.length} />
                    </text>
                    <text
                      x="60"
                      y="84"
                      textAnchor="middle"
                      className="fill-neutral-400 text-[7px] uppercase tracking-widest font-bold"
                    >
                      Games
                    </text>
                  </>
                )}
              </svg>
            </div>

            {/* List Legend */}
            <div className="w-full space-y-2 text-[10px] pt-2 border-t border-white/5">
              {segments.map((seg, idx) => {
                const isHovered = hoveredSegment === idx;
                return (
                  <div
                    key={idx}
                    className={`flex justify-between items-center transition-colors duration-150 py-0.5 px-2 rounded-lg cursor-pointer ${
                      isHovered ? "bg-white/5 text-white" : "text-neutral-400 hover:text-neutral-250"
                    }`}
                    onMouseEnter={() => setHoveredSegment(idx)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-medium truncate">{seg.name}</span>
                    </div>
                    <div className="font-mono flex items-center gap-1.5 shrink-0">
                      <span className="font-semibold text-white">{seg.count}</span>
                      <span className="text-neutral-500">({Math.round(seg.pct * 100)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
