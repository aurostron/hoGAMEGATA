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
  const [activeItem, setActiveItem] = useState(() => screenshots[0]);
  const [incomingItem, setIncomingItem] = useState<HorrorScreenshot | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (!screenshots || screenshots.length <= 1) return;

    let stepTimer: ReturnType<typeof setTimeout>;
    let completeTimer: ReturnType<typeof setTimeout>;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % screenshots.length;
        const nextItem = screenshots[next];
        setIncomingItem(nextItem);
        setFadeIn(false);

        stepTimer = setTimeout(() => {
          setFadeIn(true);
        }, 50);

        completeTimer = setTimeout(() => {
          setActiveItem(nextItem);
          setIncomingItem(null);
          setFadeIn(false);
        }, 1100);

        return next;
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
      clearTimeout(stepTimer);
      clearTimeout(completeTimer);
    };
  }, [screenshots, intervalMs]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
      {/* Base Active Slide: Lean 2-Layer DOM prevents decoding 60 simultaneous 1080p bitmaps (saves ~450MB RAM!) */}
      {activeItem && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[7500ms] scale-105"
          style={{ backgroundImage: `url(${activeItem.url})` }}
        />
      )}

      {/* Cross-Fading Incoming Slide */}
      {incomingItem && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out transform transition-transform duration-[7500ms] ${
            fadeIn ? "opacity-100 scale-105" : "opacity-0 scale-100"
          }`}
          style={{ backgroundImage: `url(${incomingItem.url})` }}
        />
      )}

      {/* Atmospheric Overlays: Heavy Dark Dim + Blur for high card readability */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/90" />

      {/* Subtle Game Caption in bottom right corner */}
      {activeItem && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-8 z-10 font-sans text-[10px] sm:text-xs uppercase tracking-widest text-neutral-400/70 text-right drop-shadow-md">
          <span>{activeItem.gameName}</span>
          <span className="text-neutral-500"> • </span>
          <span>{activeItem.devName}</span>
        </div>
      )}
    </div>
  );
}
