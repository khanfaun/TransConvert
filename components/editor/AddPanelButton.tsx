import React from 'react';
import { PlusIcon } from '../Icons';

export const AddPanelButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full h-32 lg:w-48 lg:h-auto lg:min-h-[500px] flex-shrink-0 flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-2xl shadow-lg shadow-[var(--shadow-color)] hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-active)] border-2 border-dashed border-[var(--color-border-primary)] transition-all duration-200 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)] hover:border-[var(--color-accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] self-stretch"
      aria-label="Thêm panel mới"
    >
      <div className="flex lg:flex-col items-center justify-center gap-4 lg:gap-2 text-center">
        <PlusIcon className="w-8 h-8 lg:w-10 lg:h-10" />
        <span className="mt-0 lg:mt-2 block font-semibold">Thêm chương</span>
      </div>
    </button>
  );
};
