"use client";

import { useState } from "react";
import { Share, Check } from "lucide-react";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      // Generate clean canonical link without any search parameters or hash
      const cleanUrl = window.location.origin + window.location.pathname;
      await navigator.clipboard.writeText(cleanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <div className="relative inline-block shrink-0">
      <button
        onClick={handleShare}
        className="flex items-center justify-center h-[36px] w-[36px] sm:h-[40px] sm:w-[40px] text-white hover:bg-white hover:text-black transition-all duration-150 border border-white rounded-none bg-black cursor-pointer select-none"
        title="Copy clean game link"
      >
        <Share className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
      </button>

      {copied && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-white text-black border border-white font-mono text-[9px] uppercase tracking-wider font-bold z-50 whitespace-nowrap flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)] animate-fade-in">
          <Check className="w-2.5 h-2.5" />
          <span>[ Link Copied ]</span>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-white" />
        </div>
      )}
    </div>
  );
}
