import React, { useState, useEffect } from 'react';

export default function MirrorBanner() {
  const [isMirror, setIsMirror] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hostname = window.location.hostname;
    if (hostname.endsWith('.pages.dev') || hostname === 'localhost' || hostname === '127.0.0.1') {
      setIsMirror(true);
    }
  }, []);

  if (!isMirror) return null;

  return (
    <div className="w-full bg-black border-b border-white/10 text-neutral-400 px-4 md:px-8 py-2 flex flex-wrap items-center justify-between text-[10px] md:text-xs tracking-[0.2em] uppercase font-mono z-40 relative">
      <div className="flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-white font-medium">HOGAMEGATA MIRROR</span>
        <span className="text-neutral-600 hidden sm:inline">//</span>
        <span className="text-neutral-500 hidden sm:inline">GUEST MODE (OFFLINE CATALOG)</span>
      </div>

      <div className="flex items-center gap-6 mt-1 sm:mt-0">
        <span className="text-neutral-500 text-[9px] md:text-[10px]">
          LOCAL STORAGE CART & WISHLIST
        </span>
        <a
          href="https://gamegata.xyz"
          className="text-white hover:text-neutral-300 underline underline-offset-4 flex items-center gap-1 transition-colors"
        >
          <span>PRIMARY NODE</span>
          <span className="text-[9px]">↗</span>
        </a>
      </div>
    </div>
  );
}
