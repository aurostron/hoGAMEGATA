"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface ScreenshotGalleryProps {
  screenshots: string[];
  title: string;
}

export default function ScreenshotGallery({ screenshots, title }: ScreenshotGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const selectedUrl = activeIndex !== null ? screenshots[activeIndex] : null;

  const openLightbox = (index: number) => {
    // Disable body scrolling when modal is open
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
      // Restore body scrolling
      document.body.style.overflow = "";
    }, 200); // Matches the transition-opacity duration-200
  };

  const showNext = () => {
    if (activeIndex === null) return;
    setActiveIndex((prev) => (prev !== null ? (prev + 1) % screenshots.length : null));
  };

  const showPrev = () => {
    if (activeIndex === null) return;
    setActiveIndex((prev) => (prev !== null ? (prev - 1 + screenshots.length) % screenshots.length : null));
  };

  // Listen for keys: Escape to close, Left/Right arrows to navigate
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

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {screenshots.map((url, i) => (
          <button
            key={i}
            onClick={() => openLightbox(i)}
            className="border border-white bg-black p-1 hover:bg-white transition-colors duration-150 cursor-pointer text-left block w-full focus:outline-none focus:ring-1 focus:ring-white aspect-video relative"
          >
            <Image
              src={url}
              alt={`${title} screenshot ${i + 1}`}
              fill={true}
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
              className="object-cover border border-white hover:opacity-95 transition-opacity"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedUrl && activeIndex !== null && (
        <div
          onClick={closeLightbox}
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-200 ease-out cursor-zoom-out ${
            isAnimating ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative border border-white bg-black p-1 max-w-[95vw] max-h-[90vh] flex flex-col items-center justify-center transition-all duration-200 ease-out ${
              isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            <Image
              src={selectedUrl}
              alt={`${title} screenshot enlarged`}
              width={1920}
              height={1080}
              priority={true}
              className="max-w-[90vw] max-h-[80vh] w-auto h-auto object-contain border border-white select-none"
            />

            {/* Counter (Top-Left) */}
            {screenshots.length > 1 && (
              <span className="absolute -top-10 left-0 font-mono text-[10px] uppercase tracking-widest text-white bg-black border border-white px-2.5 py-1.5 font-bold select-none">
                [ {String(activeIndex + 1).padStart(2, "0")} / {String(screenshots.length).padStart(2, "0")} ]
              </span>
            )}

            {/* Close Button (Top-Right) */}
            <button
              onClick={closeLightbox}
              className="absolute -top-10 right-0 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all border border-white bg-black px-2.5 py-1.5 cursor-pointer font-bold"
            >
              [ Close ]
            </button>

            {/* Previous Button (Responsive: overlay on mobile, outside on desktop) */}
            {screenshots.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                className="absolute left-2 md:-left-12 top-1/2 -translate-y-1/2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all border border-white bg-black/75 md:bg-black w-8 h-12 flex items-center justify-center cursor-pointer font-bold select-none z-50 focus:outline-none focus:ring-1 focus:ring-white"
                aria-label="Previous screenshot"
              >
                &lt;
              </button>
            )}

            {/* Next Button (Responsive: overlay on mobile, outside on desktop) */}
            {screenshots.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                className="absolute right-2 md:-right-12 top-1/2 -translate-y-1/2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all border border-white bg-black/75 md:bg-black w-8 h-12 flex items-center justify-center cursor-pointer font-bold select-none z-50 focus:outline-none focus:ring-1 focus:ring-white"
                aria-label="Next screenshot"
              >
                &gt;
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
