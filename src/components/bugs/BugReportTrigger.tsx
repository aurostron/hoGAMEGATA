import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { BugReportModal } from './BugReportModal';

interface BugReportTriggerProps {
  className?: string;
  variant?: 'default' | 'footer';
}

export const BugReportTrigger: React.FC<BugReportTriggerProps> = ({ 
  className = '',
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const buttonClasses = variant === 'footer'
    ? `group inline-flex items-center gap-1.5 h-[34px] px-2.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-xs text-neutral-300 hover:text-white font-sans transition-all duration-150 cursor-pointer select-none shrink-0 ${className}`
    : `inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-white/90 hover:text-white font-sans text-xs tracking-tight font-semibold transition-all cursor-pointer select-none active:scale-95 shrink-0 shadow-sm ${className}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={buttonClasses}
        title="Report a bug or dead link"
        aria-label="Report Bug"
      >
        <Bug className={`w-4 h-4 shrink-0 transition-colors ${variant === 'footer' ? 'text-neutral-400 group-hover:text-red-400' : 'text-red-400'}`} />
        <span className={variant === 'footer' ? 'inline font-medium text-xs' : 'hidden sm:inline'}>Report Bug</span>
      </button>

      <BugReportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
