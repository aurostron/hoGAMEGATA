"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NyanLoader from "./NyanLoader";
import { LOADING_MESSAGES } from "@/lib/loading-messages";

export default function PageTransitionLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");

  const [isMounted, setIsMounted] = useState(false);
  const [isFadeIn, setIsFadeIn] = useState(false);

  const currentKey = pathname + (searchParams?.toString() || "");
  const [prevKey, setPrevKey] = useState(currentKey);

  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams);

  useEffect(() => {
    pathnameRef.current = pathname;
    searchParamsRef.current = searchParams;
  }, [pathname, searchParams]);

  // Synchronously reset navigation state on route change during render
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setIsNavigating(false);
  }

  // Triggered on any URL/Search parameter changes (fallback)
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  // Handle CSS transition fade states
  useEffect(() => {
    if (isNavigating) {
      setIsMounted(true);
      const timer = setTimeout(() => {
        setIsFadeIn(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsFadeIn(false);
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 300); // 300ms matches transition duration
      return () => clearTimeout(timer);
    }
  }, [isNavigating]);

  useEffect(() => {
    const pickRandomMessage = () => {
      const randomIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
      setCurrentMessage(LOADING_MESSAGES[randomIndex]);
    };

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

        // Trigger transition loading with a random message
        pickRandomMessage();
        setIsNavigating(true);
      } catch (err) {
        // Fallback for any invalid URLs
      }
    };

    const handlePopState = () => {
      // Back/forward navigation: only show loader if Next.js hasn't already transitioned to the new page
      const normalizePath = (path: string) => {
        if (path.length > 1 && path.endsWith("/")) {
          return path.slice(0, -1);
        }
        return path;
      };

      const browserPath = normalizePath(window.location.pathname);
      const reactPath = normalizePath(pathnameRef.current);
      
      const browserSearch = window.location.search;
      const reactSearch = searchParamsRef.current?.toString() ? "?" + searchParamsRef.current.toString() : "";

      const currentBrowserKey = browserPath + browserSearch;
      const currentReactKey = reactPath + reactSearch;

      if (currentBrowserKey !== currentReactKey) {
        pickRandomMessage();
        setIsNavigating(true);
      }
    };

    const handleCustomRouteStart = () => {
      // Programmatic route start
      pickRandomMessage();
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

  if (!isMounted) return null;

  return (
    <NyanLoader 
      fullScreen 
      message={currentMessage} 
      className={`transition-all duration-300 ease-out ${
        isFadeIn 
          ? "opacity-100 backdrop-blur-md" 
          : "opacity-0 backdrop-blur-none pointer-events-none"
      }`} 
    />
  );
}
