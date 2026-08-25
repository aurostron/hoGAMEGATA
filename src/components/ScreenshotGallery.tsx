"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X, ExternalLink, Eye } from "lucide-react";

interface ScreenshotGalleryProps {
  screenshots: string[];
  title: string;
}

export default function ScreenshotGallery({ screenshots, title }: ScreenshotGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const selectedUrl = activeIndex !== null ? screenshots[activeIndex] : null;

  const openLightbox = (index: number) => {
    document.body.style.overflow = "hidden";
    setActiveIndex(index);
    setTimeout(() => {
      setIsAnimating(true);
    }, 10);
  };

  const closeLightbox = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setActiveIndex(null);
      document.body.style.overflow = "";
    }, 200);
  };

  const showNext = () => {
    if (activeIndex === null) return;
    setActiveIndex((prev) => (prev !== null ? (prev + 1) % screenshots.length : null));
  };

  const showPrev = () => {
    if (activeIndex === null) return;
    setActiveIndex((prev) => (prev !== null ? (prev - 1 + screenshots.length) % screenshots.length : null));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowRight") {
        showNext();
      } else if (e.key === "ArrowLeft") {
        showPrev();
      }
    };
    if (activeIndex !== null) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeIndex, screenshots.length]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) {
      showNext();
    } else if (distance < -minSwipeDistance) {
      showPrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <>
      {/* Screenshot Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
        {screenshots.map((url, i) => (
          <button
            key={i}
            onClick={() => openLightbox(i)}
            className="group relative rounded-2xl border border-white/10 bg-neutral-950/60 overflow-hidden aspect-video transition-all duration-300 hover:border-white/25 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] cursor-pointer text-left block w-full focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <img
              src={url}
              alt={`${title} screenshot ${i + 1}`}
              className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
            />
            {/* Subtle Gradient & Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 shadow-sm">
                <Eye className="w-3.5 h-3.5 text-white/70" />
                <span>View</span>
              </span>
              <span className="text-[11px] font-mono text-white/60 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/5">
                {String(i + 1).padStart(2, "0")} / {String(screenshots.length).padStart(2, "0")}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Modern Lightbox Modal */}
      {selectedUrl && activeIndex !== null && (
        <div
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`fixed inset-0 z-[100] flex flex-col justify-between p-4 sm:p-6 bg-black/92 backdrop-blur-2xl transition-opacity duration-250 ease-out ${
            isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Top Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl mx-auto flex items-center justify-between z-30 pt-1 select-none"
          >
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/90 shadow-sm">
                {String(activeIndex + 1).padStart(2, "0")} / {String(screenshots.length).padStart(2, "0")}
              </span>
              <span className="text-xs sm:text-sm font-medium text-white/60 hidden sm:inline truncate max-w-md">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={selectedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original screenshot"
                className="p-2 sm:p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/75 hover:text-white transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={closeLightbox}
                title="Close (Esc)"
                className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 hover:text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Viewer & Floating Nav Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex items-center justify-center w-full max-w-5xl mx-auto my-auto py-2"
          >
            {/* Previous Button */}
            {screenshots.length > 1 && (
              <button
                onClick={showPrev}
                aria-label="Previous screenshot"
                className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur-xl border border-white/15 text-white/90 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-2xl z-20 hover:scale-110 active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* Selected Image */}
            <div
              className={`relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-[0_0_50px_rgba(0,0,0,0.85)] max-w-[92vw] max-h-[68vh] sm:max-h-[74vh] transition-all duration-200 ease-out ${
                isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              <img
                src={selectedUrl}
                alt={`${title} screenshot enlarged`}
                className="max-w-[90vw] max-h-[66vh] sm:max-h-[72vh] w-auto h-auto object-contain select-none"
              />
            </div>

            {/* Next Button */}
            {screenshots.length > 1 && (
              <button
                onClick={showNext}
                aria-label="Next screenshot"
                className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur-xl border border-white/15 text-white/90 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-2xl z-20 hover:scale-110 active:scale-95"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {screenshots.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl mx-auto flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 select-none scrollbar-none"
            >
              {screenshots.map((thumb, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveIndex(idx)}
                    className={`relative rounded-xl overflow-hidden shrink-0 w-14 sm:w-16 h-9 sm:h-10 transition-all duration-200 cursor-pointer border ${
                      isActive
                        ? "border-white ring-2 ring-white/80 scale-105 shadow-lg opacity-100"
                        : "border-white/10 opacity-40 hover:opacity-90 hover:border-white/30"
                    }`}
                  >
                    <img src={thumb} alt={`thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
