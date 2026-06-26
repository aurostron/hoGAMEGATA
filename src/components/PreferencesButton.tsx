"use client";

import { useState, useEffect } from "react";
import { usePreferences } from "@/hooks/usePreferences";

export default function PreferencesButton() {
  const { openModal } = usePreferences();
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  if (pathname === "/waitlist") {
    return null;
  }

  return (
    <button
      onClick={openModal}
      className="border border-white bg-black hover:bg-white hover:text-black text-white px-3 py-1 text-[10px] uppercase tracking-widest font-black transition-colors cursor-pointer"
    >
      [ PREFERENCES ]
    </button>
  );
}
