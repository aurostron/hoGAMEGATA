"use client";

import { usePreferences } from "@/hooks/usePreferences";

export default function PreferencesButton() {
  const { openModal } = usePreferences();

  return (
    <button
      onClick={openModal}
      className="border border-white bg-black hover:bg-white hover:text-black text-white px-3 py-1 text-[10px] uppercase tracking-widest font-black transition-colors"
    >
      [ PREFERENCES ]
    </button>
  );
}
