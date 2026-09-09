import React, { useState, useEffect } from "react";
import { CURATED_HORROR_SCREENSHOTS, type HorrorScreenshot } from "../data/curatedScreenshots";

interface KenBurnsBackgroundProps {
  screenshots?: HorrorScreenshot[];
  intervalMs?: number;
}

export default function KenBurnsBackground({
  screenshots = CURATED_HORROR_SCREENSHOTS,
  intervalMs = 6500,
}: KenBurnsBackgroundProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!screenshots || screenshots.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % screenshots.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [screenshots, intervalMs]);

  // Preload next slide image
  useEffect(() => {
    if (!screenshots || screenshots.length === 0) return;
    const nextIdx = (currentSlide + 1) % screenshots.length;
    const img = new Image();
    img.src = screenshots[nextIdx].url;
  }, [currentSlide, screenshots]);

  const activeScreenshot = screenshots[currentSlide];

  return (
    <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
      {/* Background Slides */}
      {screenshots.map((item, idx) => (
        <div
          key={item.url}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out transform transition-transform duration-[7500ms] ${
            idx === currentSlide ? "opacity-100 scale-105" : "opacity-0 scale-100"
          }`}
          style={{
            backgroundImage: `url(${item.url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ))}

      {/* Atmospheric Overlays: Heavy Dark Dim + Blur for high card readability */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/90" />

      {/* Subtle Game Caption in bottom right corner */}
      {activeScreenshot && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-8 z-10 font-sans text-[10px] sm:text-xs uppercase tracking-widest text-neutral-400/70 text-right drop-shadow-md">
          <span>{activeScreenshot.gameName}</span>
          <span className="text-neutral-500"> • </span>
          <span>{activeScreenshot.devName}</span>
        </div>
      )}
    </div>
  );
}
