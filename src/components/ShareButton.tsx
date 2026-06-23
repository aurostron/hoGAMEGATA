"use client";

import { useState } from "react";
import { Link as LinkIcon, Check } from "lucide-react";

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
    <div className="relative inline-block">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 font-mono text-[9px] sm:text-[10px] text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-2.5 py-1.5 font-bold rounded-none bg-black cursor-pointer select-none"
        title="Copy clean game link"
      >
        <LinkIcon className="w-3 h-3" />
        <span>[ Share ]</span>
      </button>

      {copied && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-white text-black border border-white font-mono text-[9px] uppercase tracking-wider font-bold z-50 whitespace-nowrap flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]">
          <Check className="w-2.5 h-2.5" />
          <span>[ Link Copied ]</span>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-white" />
        </div>
      )}
    </div>
  );
}
