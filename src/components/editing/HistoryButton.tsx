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
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-neutral-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 ${className}`}
        title="View Edit History"
      >
        <History className="w-3.5 h-3.5 text-neutral-400" />
        <span>History</span>
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
