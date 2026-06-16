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
      className="border border-white bg-black p-6 space-y-6 select-none"
      onCopy={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex justify-between items-baseline border-b border-white/20 pb-4">
        <h3 className="font-mono text-sm uppercase tracking-widest font-black text-white flex items-center gap-2">
          ⚡ Scare Profile
          {reviewCount && (
            <span className="group relative cursor-help">
              <Info className="w-3 h-3 text-white/40 group-hover:text-white transition-colors" />
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max bg-white text-black font-mono text-[9px] font-black uppercase tracking-wider px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                AI analyzed {reviewCount} top Steam Reviews
              </span>
            </span>
          )}
        </h3>
        <span className="font-mono text-xl font-black text-white">{scareRating} <span className="text-xs text-white/50">/ 100</span></span>
      </div>

      {scareProfile?.shortSummary && (
        <div className="bg-white/5 border border-white/10 p-4">
          <p className="font-mono text-xs text-white/80 leading-relaxed">
            {scareProfile.shortSummary}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {dimensions.map(({ key, label }) => {
          const value = (scareProfile as any)[key] || 0;
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between items-baseline font-mono text-[10px] uppercase font-bold tracking-wider">
                <span className="text-white/80">{label}</span>
                <span className="text-white">{value}%</span>
              </div>
              <div className="h-2 w-full bg-white/10 border border-white/20 overflow-hidden relative">
                <div 
                  className="h-full bg-white transition-all duration-[1200ms]"
                  style={{ 
                    width: mounted ? `${value}%` : '0%',
                    transitionTimingFunction: 'steps(12, end)'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {scareProfile?.playerWarnings && scareProfile.playerWarnings.length > 0 && (
        <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2">
          {scareProfile.playerWarnings.map((warning, idx) => (
            <span key={idx} className="bg-red-950/40 text-red-400 border border-red-900/50 px-2 py-1 text-[9px] font-mono uppercase tracking-widest font-black">
              {warning}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
