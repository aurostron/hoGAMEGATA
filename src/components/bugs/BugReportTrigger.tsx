import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { BugReportModal } from './BugReportModal';

interface BugReportTriggerProps {
  className?: string;
}

export const BugReportTrigger: React.FC<BugReportTriggerProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-white/90 hover:text-white font-sans text-xs tracking-tight font-semibold transition-all cursor-pointer select-none active:scale-95 shrink-0 shadow-sm ${className}`}
        title="Report a bug or issue"
        aria-label="Report Bug"
      >
        <Bug className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="hidden sm:inline">Report Bug</span>
      </button>

      <BugReportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
