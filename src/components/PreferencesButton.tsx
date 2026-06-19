"use client";

import { usePreferences } from "@/hooks/usePreferences";
import { usePathname } from "next/navigation";

export default function PreferencesButton() {
  const { openModal } = usePreferences();
  const pathname = usePathname();

  if (pathname === "/waitlist") {
    return null;
  }

  return (
    <button
      onClick={openModal}
      className="border border-white bg-black hover:bg-white hover:text-black text-white px-3 py-1 text-[10px] uppercase tracking-widest font-black transition-colors"
    >
      [ PREFERENCES ]
    </button>
  );
}
