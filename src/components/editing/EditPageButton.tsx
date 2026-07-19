import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { EditPageModal } from './EditPageModal';

interface EditPageButtonProps {
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
  className?: string;
}

export const EditPageButton: React.FC<EditPageButtonProps> = ({
  gameId,
  gameTitle,
  gameData,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-neutral-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 ${className}`}
        title="Edit game metadata"
      >
        <Pencil className="w-3.5 h-3.5 text-neutral-400" />
        <span>Edit Page</span>
      </button>

      <EditPageModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        gameId={gameId}
        gameTitle={gameTitle}
        gameData={gameData}
      />
    </>
  );
};
