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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-white/70 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer select-none active:scale-95 ${className}`}
        title="Report a bug or issue"
      >
        <Bug className="w-3 h-3 text-red-400" />
        <span>Report Bug</span>
      </button>

      <BugReportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
