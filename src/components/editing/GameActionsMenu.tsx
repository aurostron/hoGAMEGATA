import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, Bug, History } from 'lucide-react';
import { EditPageModal } from './EditPageModal';
import { BugReportModal } from '../bugs/BugReportModal';
import { RevisionHistoryModal } from './RevisionHistoryModal';

interface GameActionsMenuProps {
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
  };
}

export const GameActionsMenu: React.FC<GameActionsMenuProps> = ({
  gameId,
  gameTitle,
  gameData,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const menuItems = [
    {
      icon: Pencil,
      label: 'Edit Page',
      onClick: () => { setMenuOpen(false); setEditOpen(true); },
    },
    {
      icon: Bug,
      label: 'Report a Problem',
      onClick: () => { setMenuOpen(false); setBugOpen(true); },
    },
    {
      icon: History,
      label: 'View History',
      onClick: () => { setMenuOpen(false); setHistoryOpen(true); },
    },
  ];

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* ··· trigger */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all"
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl bg-[#131316] border border-white/10 shadow-2xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <EditPageModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        gameId={gameId}
        gameTitle={gameTitle}
        gameData={gameData}
      />
      <BugReportModal isOpen={bugOpen} onClose={() => setBugOpen(false)} />
      <RevisionHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        gameId={gameId}
        gameTitle={gameTitle}
      />
    </>
  );
};
