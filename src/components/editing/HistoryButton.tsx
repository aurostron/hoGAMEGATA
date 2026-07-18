import React, { useState } from 'react';
import { History } from 'lucide-react';
import { RevisionHistoryModal } from './RevisionHistoryModal';

interface HistoryButtonProps {
  gameId: string;
  gameTitle: string;
  isAdmin?: boolean;
  className?: string;
}

export const HistoryButton: React.FC<HistoryButtonProps> = ({
  gameId,
  gameTitle,
  isAdmin = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all ${className}`}
      >
        <History className="w-3.5 h-3.5 text-zinc-400" />
        <span>View History</span>
      </button>

      <RevisionHistoryModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        gameId={gameId}
        gameTitle={gameTitle}
        isAdmin={isAdmin}
      />
    </>
  );
};
