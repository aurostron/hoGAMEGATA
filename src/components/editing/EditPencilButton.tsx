import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { SuggestEditModal } from './SuggestEditModal';

interface EditPencilButtonProps {
  gameId: string;
  gameTitle: string;
  field: string;
  fieldLabel: string;
  currentValue: string;
  isMultiline?: boolean;
  className?: string;
}

export const EditPencilButton: React.FC<EditPencilButtonProps> = ({
  gameId,
  gameTitle,
  field,
  fieldLabel,
  currentValue,
  isMultiline = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={`Suggest edit for ${fieldLabel}`}
        aria-label={`Suggest edit for ${fieldLabel}`}
        className={`inline-flex items-center justify-center p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer ${className}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <SuggestEditModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        gameId={gameId}
        gameTitle={gameTitle}
        field={field}
        fieldLabel={fieldLabel}
        currentValue={currentValue}
        isMultiline={isMultiline}
      />
    </>
  );
};
