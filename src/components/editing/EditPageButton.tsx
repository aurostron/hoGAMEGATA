import React, { useState, useEffect } from 'react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetFieldKey, setTargetFieldKey] = useState('summary');

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      if (e.detail?.fieldKey) {
        setTargetFieldKey(e.detail.fieldKey);
      } else {
        setTargetFieldKey('summary');
      }
      setIsModalOpen(true);
    };

    window.addEventListener('gg-open-edit-modal', handleOpenModal);
    return () => window.removeEventListener('gg-open-edit-modal', handleOpenModal);
  }, []);

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => {
            setTargetFieldKey('summary');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/10 hover:border-amber-400/60 bg-white/5 hover:bg-amber-500/10 text-white/90 hover:text-amber-300 transition-all duration-200 cursor-pointer active:scale-95 text-xs font-semibold shrink-0 select-none shadow-sm"
          title="Edit or Suggest Improvements for this Page"
          aria-label="Edit this page"
        >
          <Pencil className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-sans text-xs tracking-tight font-bold">
            Edit this page
          </span>
        </button>
      </div>

      <EditPageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gameId={gameId}
        gameTitle={gameTitle}
        gameData={gameData}
        initialFieldKey={targetFieldKey}
      />
    </>
  );
};
