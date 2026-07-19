"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

export default function ReadMoreScrollButton() {
  const scrollToDetails = () => {
    const target = document.getElementById("details-overview-section");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollBy({ top: 450, behavior: "smooth" });
    }
  };

  return (
    <div className="pt-3">
      <button
        onClick={scrollToDetails}
        className="group inline-flex items-center gap-1.5 text-white/40 hover:text-white font-mono text-sm tracking-wider transition-colors duration-200 cursor-pointer select-none bg-transparent border-none p-0 outline-none"
        title="Scroll to game overview & media"
      >
        <span>Read more...</span>
        <ChevronDown className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-y-0.5 transition-all duration-200" />
      </button>
    </div>
  );
}
