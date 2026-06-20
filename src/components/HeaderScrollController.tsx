"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function HeaderScrollController() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Find header
    const header = document.querySelector("header");
    if (!header) return;

    // Apply smooth transform transition style to the header
    header.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease";

    let lastScrollY = window.scrollY;
    let isHidden = false;
    let threshold = 50;

    const findTargetElement = (): HTMLElement | null => {
      // 1. On homepage, find the hero h1 title
      if (pathname === "/") {
        const h1 = document.querySelector("h1");
        if (h1 && h1.textContent?.toLowerCase().includes("curated horror")) {
          return h1 as HTMLElement;
        }
      }

      // 2. On game details page, find the game title h2
      if (pathname.startsWith("/game/")) {
        const main = document.querySelector("main");
        if (main) {
          const h2 = main.querySelector("h2");
          if (h2) return h2 as HTMLElement;
        }
      }

      // 3. For generic pages, look for the first visible h1/h2 outside the header
      const headings = Array.from(document.querySelectorAll("h1, h2, h3")) as HTMLElement[];
      for (const h of headings) {
        if (header.contains(h)) continue;
        if (!h.offsetParent || !h.textContent?.trim()) continue;
        return h;
      }

      // Fallback: first child inside main
      const main = document.querySelector("main");
      if (main && main.firstElementChild) {
        return main.firstElementChild as HTMLElement;
      }

      return null;
    };

    const updateThreshold = () => {
      const targetElement = findTargetElement();
      if (targetElement && header) {
        const rect = targetElement.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        // The bottom of the header hits the top of the text when scrollY = absoluteTop - headerHeight
        threshold = Math.max(0, absoluteTop - header.offsetHeight);
      } else {
        threshold = 50; // Fallback
      }
    };

    // Calculate threshold immediately
    updateThreshold();

    // Re-check periodically to handle dynamic content/image loads
    const timer1 = setTimeout(updateThreshold, 100);
    const timer2 = setTimeout(updateThreshold, 500);
    const timer3 = setTimeout(updateThreshold, 1500);

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const headerHeight = header.offsetHeight;

      if (currentScrollY <= threshold) {
        // Force show when above threshold (before hitting target element)
        if (isHidden) {
          header.style.transform = "translateY(0)";
          isHidden = false;
        }
      } else {
        // Below threshold: hide on scroll down, show on scroll up
        if (currentScrollY > lastScrollY) {
          // Scrolling down -> hide
          if (!isHidden) {
            header.style.transform = `translateY(-${headerHeight}px)`;
            isHidden = true;
          }
        } else {
          // Scrolling up -> show
          if (isHidden) {
            header.style.transform = "translateY(0)";
            isHidden = false;
          }
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateThreshold);

    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateThreshold);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (header) {
        header.style.transform = "";
        header.style.transition = "";
      }
    };
  }, [pathname, searchParams]);

  return null;
}
