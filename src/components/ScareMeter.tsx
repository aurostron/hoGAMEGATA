"use client";

import React, { useEffect, useState } from "react";
import { Info } from "lucide-react";

interface ScareProfile {
  dread: number;
  jumpscare: number;
  psychological: number;
  gore: number;
  tension: number;
  disturbing: number;
  isolation: number;
  shortSummary?: string;
  playerWarnings?: string[];
}

interface ScareMeterProps {
  scareRating: number;
  scareProfile: ScareProfile;
  reviewCount: number | null;
}

export default function ScareMeter({ scareRating, scareProfile, reviewCount }: ScareMeterProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay mounting slightly to trigger the CSS animation reliably
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const dimensions = [
    { key: "dread", label: "Dread / Atmosphere" },
    { key: "jumpscare", label: "Jump Scares" },
    { key: "psychological", label: "Psychological" },
    { key: "gore", label: "Gore & Violence" },
    { key: "tension", label: "Tension & Panic" },
    { key: "disturbing", label: "Disturbing" },
    { key: "isolation", label: "Isolation" }
  ];

  return (
    <div 
      className="border border-white/5 bg-[#131316]/50 backdrop-blur-md p-6 space-y-6 select-none rounded-2xl shadow-2xl"
      onCopy={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex justify-between items-baseline border-b border-white/5 pb-4">
        <h3 className="font-sans text-[11px] uppercase tracking-widest font-bold text-white/50 flex items-center gap-2">
          ⚡ Scare Profile
          {reviewCount && (
            <span className="group relative cursor-help">
              <Info className="w-3 h-3 text-white/40 group-hover:text-white transition-colors" />
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max bg-zinc-900 text-white font-mono text-[9px] font-semibold uppercase tracking-wider px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 rounded border border-white/10">
                AI analyzed {reviewCount} top Steam Reviews
              </span>
            </span>
          )}
        </h3>
        <span className="font-mono text-xl font-bold text-white">{scareRating} <span className="text-xs text-white/50">/ 100</span></span>
      </div>

      {scareProfile?.shortSummary && (
        <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
          <p className="scare-summary text-xs text-neutral-300 leading-relaxed font-medium">
            {scareProfile.shortSummary}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {dimensions.map(({ key, label }) => {
          const value = (scareProfile as any)[key] || 0;
          return (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-baseline text-xs tracking-wide">
                <span className="text-neutral-450 font-medium">{label}</span>
                <span className="font-mono text-xs text-white font-medium">{value}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 overflow-hidden relative rounded-full">
                <div 
                  className="h-full bg-white transition-all duration-[1000ms] rounded-full"
                  style={{ 
                    width: mounted ? `${value}%` : '0%',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {scareProfile?.playerWarnings && scareProfile.playerWarnings.length > 0 && (
        <div className="pt-4 border-t border-white/5 flex flex-wrap gap-2">
          {scareProfile.playerWarnings.map((warning, idx) => (
            <span key={idx} className="scare-warning bg-red-950/20 text-red-400/90 border border-red-950/40 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider rounded-md font-semibold">
              {warning}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
