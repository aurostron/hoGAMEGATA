"use client";

import { ArrowLeft } from "lucide-react";

export default function ReturnButton() {
  const handleReturn = () => {
    if (
      typeof window !== "undefined" &&
      document.referrer &&
      document.referrer.includes(window.location.host)
    ) {
      window.history.back();
    } else {
      window.location.assign("/");
    }
  };

  return (
    <button
      onClick={handleReturn}
      className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
      <span>[ Return to Search ]</span>
    </button>
  );
}
