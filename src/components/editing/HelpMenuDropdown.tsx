import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Bug, History } from 'lucide-react';
import { EditPageModal } from './EditPageModal';
import { BugReportModal } from '../bugs/BugReportModal';
import { RevisionHistoryModal } from './RevisionHistoryModal';

interface HelpMenuDropdownProps {
  gameId: string;
  gameTitle: string;
  gameData: {
    developerNames?: string;
    summary?: string;
    storyline?: string;
    trailerUrl?: string;
    websiteUrl?: string;
    redditUrl?: string;
    esrbRating?: string;
    pegiRating?: string;
    rating?: number | null;
    metacritic?: number | null;
    playtime?: number | null;
    platformNames?: string;
    protonDbTier?: string;
    purchaseLinks?: Array<{ id?: string; storeName: string; url: string }>;
    publisherNames?: string;
    genreNames?: string;
    releaseDate?: string;
    multiplayer?: string;
    controllerSupport?: string;
    vrSupport?: string;
    playerWarnings?: string;
  };
  isAdmin?: boolean;
  className?: string;
}

export const HelpMenuDropdown: React.FC<HelpMenuDropdownProps> = ({
  gameId,
  gameTitle,
  gameData,
  isAdmin = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'edit' | 'bug' | 'history' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-neutral-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
        title="Help & Page Actions"
      >
        <MoreVertical className="w-4 h-4 text-neutral-400" />
        <span>Help</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#121215] border border-white/15 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setActiveModal('edit');
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-neutral-400" />
            <span>Edit Page</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setActiveModal('bug');
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <Bug className="w-3.5 h-3.5 text-neutral-400" />
            <span>Report Bug</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setActiveModal('history');
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors border-t border-white/5 mt-1 pt-2"
          >
            <History className="w-3.5 h-3.5 text-neutral-400" />
            <span>View Timeline History</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <EditPageModal
        isOpen={activeModal === 'edit'}
        onClose={() => setActiveModal(null)}
        gameId={gameId}
        gameTitle={gameTitle}
        gameData={gameData}
      />

      <BugReportModal
        isOpen={activeModal === 'bug'}
        onClose={() => setActiveModal(null)}
      />

      <RevisionHistoryModal
        isOpen={activeModal === 'history'}
        onClose={() => setActiveModal(null)}
        gameId={gameId}
        gameTitle={gameTitle}
        isAdmin={isAdmin}
      />
    </div>
  );
};
