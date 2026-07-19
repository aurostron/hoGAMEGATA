"use client";

import { useState } from "react";
import { Forward, Check } from "lucide-react";

interface ShareButtonProps {
  className?: string;
}

export default function ShareButton({ className = '' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      // Generate clean canonical link without any search parameters or hash
      const cleanUrl = window.location.origin + window.location.pathname;
      await navigator.clipboard.writeText(cleanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-neutral-400 hover:text-white transition-all cursor-pointer group focus:outline-none ${className}`}
      title="Share Game Page"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 text-xs font-mono font-medium">Copied!</span>
        </>
      ) : (
        <>
          <Forward className="w-4 h-4 text-neutral-400 group-hover:text-white group-hover:stroke-[2.5] transition-all" />
          <span className="text-xs font-mono text-neutral-400 group-hover:text-white transition-colors">Share</span>
        </>
      )}
    </button>
  );
}
