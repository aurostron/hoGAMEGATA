import { Settings } from "lucide-react";

export default function SettingsButton() {
  return (
    <button data-tour="options-button" className="flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold cursor-pointer bg-black" title="Settings">
      <Settings className="w-3.5 h-3.5" />
      <span>[ Options ]</span>
    </button>
  );
}
