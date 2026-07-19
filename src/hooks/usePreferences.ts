"use client";

import { useState, useEffect, useCallback } from "react";

const PREF_KEY = "gamegata_vibes";
const ONBOARD_KEY = "gamegata_onboarded";
export const OPEN_MODAL_EVENT = "gamegata_open_modal";
export const CLOSE_MODAL_EVENT = "gamegata_close_modal";

export function usePreferences() {
  const [vibes, setVibesState] = useState<string[]>([]);
  const [hasOnboarded, setHasOnboardedState] = useState<boolean>(true); // Default true to avoid flash
  const [isLoaded, setIsLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const storedVibes = localStorage.getItem(PREF_KEY);
    if (storedVibes) {
      try {
        setVibesState(JSON.parse(storedVibes));
      } catch (e) {
        console.error("Failed to parse vibes from local storage", e);
      }
    }
    
    const onboarded = localStorage.getItem(ONBOARD_KEY);
    if (onboarded === "true") {
      setHasOnboardedState(true);
    } else {
      setHasOnboardedState(false);
    }
    setIsLoaded(true);

    const handleCustomChange = () => {
      const v = localStorage.getItem(PREF_KEY);
      if (v) setVibesState(JSON.parse(v));
      const o = localStorage.getItem(ONBOARD_KEY);
      setHasOnboardedState(o === "true");
    };

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    window.addEventListener("storage", handleCustomChange);
    window.addEventListener("gamegata_prefs_updated", handleCustomChange);
    window.addEventListener(OPEN_MODAL_EVENT, handleOpenModal);
    window.addEventListener(CLOSE_MODAL_EVENT, handleCloseModal);
    
    return () => {
      window.removeEventListener("storage", handleCustomChange);
      window.removeEventListener("gamegata_prefs_updated", handleCustomChange);
      window.removeEventListener(OPEN_MODAL_EVENT, handleOpenModal);
      window.removeEventListener(CLOSE_MODAL_EVENT, handleCloseModal);
    };
  }, []);

  const completeOnboarding = useCallback((newVibes: string[]) => {
    setVibesState(newVibes);
    setHasOnboardedState(true);
    setIsModalOpen(false);
    
    localStorage.setItem(PREF_KEY, JSON.stringify(newVibes));
    localStorage.setItem(ONBOARD_KEY, "true");
    
    window.dispatchEvent(new Event("gamegata_prefs_updated"));
    window.dispatchEvent(new Event(CLOSE_MODAL_EVENT));
  }, []);

  const openModal = useCallback(() => {
    window.dispatchEvent(new Event(OPEN_MODAL_EVENT));
  }, []);

  const closeModal = useCallback(() => {
    window.dispatchEvent(new Event(CLOSE_MODAL_EVENT));
  }, []);

  return { 
    vibes, 
    hasOnboarded, 
    isLoaded, 
    isModalOpen, 
    completeOnboarding, 
    openModal, 
    closeModal 
  };
}
