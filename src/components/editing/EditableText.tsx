import React from 'react';
import { Pencil } from 'lucide-react';
import { openEditModalBus } from '../../lib/inlineEditBus';

interface EditableTextProps {
  fieldKey: string;
  initialValue: string;
  label?: string;
  isMultiline?: boolean;
  className?: string;
  tag?: 'p' | 'div' | 'span' | 'h1' | 'h2' | 'h3';
}

export const EditableText: React.FC<EditableTextProps> = ({
  fieldKey,
  initialValue,
  label = 'Section',
  className = '',
  tag: Tag = 'p',
}) => {
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openEditModalBus(fieldKey);
  };

  return (
    <div className="group relative rounded-2xl p-3 -m-3 transition-all hover:bg-white/[0.02] border border-transparent hover:border-white/10 select-text">
      <Tag className={className}>{initialValue || <span className="italic text-neutral-500">(No {label.toLowerCase()} available)</span>}</Tag>
      
      <button
        type="button"
        onClick={handleEditClick}
        title={`Edit ${label}`}
        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 px-2.5 py-1 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 hover:text-amber-200 text-[11px] font-mono font-bold rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
      >
        <Pencil className="w-3 h-3 text-amber-400" />
        Edit {label}
      </button>
    </div>
  );
};
