"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NyanLoader from "./NyanLoader";

export default function PageTransitionLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  // Triggered on any URL/Search parameter changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore standard non-navigation anchors
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      ) {
        return;
      }

      // Check if it is a local internal link
      try {
        const url = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        // Ignore external links
        if (url.origin !== currentUrl.origin) return;

        // Ignore same page Transitions (only changing hash or nothing)
        const isSamePath = url.pathname === currentUrl.pathname;
        const isSameSearch = url.search === currentUrl.search;

        if (isSamePath && isSameSearch) {
          return;
        }

        // Trigger transition loading
        setIsNavigating(true);
      } catch (err) {
        // Fallback for any invalid URLs
      }
    };

    const handlePopState = () => {
      // Back/forward navigation
      setIsNavigating(true);
    };

    const handleCustomRouteStart = () => {
      // Programmatic route start
      setIsNavigating(true);
    };

    document.addEventListener("click", handleAnchorClick);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("nextjs-route-start", handleCustomRouteStart);

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("nextjs-route-start", handleCustomRouteStart);
    };
  }, []);

  // Safety timeout to prevent screen getting stuck indefinitely
  useEffect(() => {
    if (!isNavigating) return;

    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 10000); // 10 seconds safety timeout

    return () => clearTimeout(timer);
  }, [isNavigating]);

  if (!isNavigating) return null;

  return <NyanLoader fullScreen message="LOADING REGISTRY CONTENT..." />;
}
