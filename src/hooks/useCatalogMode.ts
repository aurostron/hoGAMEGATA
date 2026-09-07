"use client";

import { useState, useEffect, useCallback } from "react";

const MODE_KEY = "gamegata_catalog_mode";
const MODE_EVENT = "gamegata_catalog_mode_changed";

export type CatalogMode = "local" | "cloud";

export function useCatalogMode() {
  const [mode, setModeState] = useState<CatalogMode>("local");

  useEffect(() => {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "local" || stored === "cloud") {
      setModeState(stored);
    } else {
      setModeState("local");
    }

    const handleChange = () => {
      const val = localStorage.getItem(MODE_KEY);
      if (val === "local" || val === "cloud") {
        setModeState(val);
      } else {
        setModeState("local");
      }
    };

    window.addEventListener(MODE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(MODE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const setMode = useCallback((newMode: CatalogMode) => {
    localStorage.setItem(MODE_KEY, newMode);
    setModeState(newMode);
    window.dispatchEvent(new Event(MODE_EVENT));
  }, []);

  return { mode, setMode };
}
