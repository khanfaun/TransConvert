import React from 'react';
import type { PanelState } from '../../types';
import { CloseIcon, AlertTriangleIcon, RefreshIcon } from '../Icons';

export const TranslationPanel: React.FC<{
  panel: PanelState;
  onUpdate: (id: string, updates: Partial<PanelState>) => void;
  onRemove: (id: string) => void;
  canBeRemoved: boolean;
  onRetry: (id: string) => void;
}> = ({ panel, onUpdate, onRemove, canBeRemoved, onRetry }) => {
  const { id, storyName, chapterNumber, inputText, tags, isLoading, error } = panel;
  
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl shadow-[var(--shadow-color)] p-6 sm:p-8 w-full lg:w-[520px] flex-shrink-0 relative space-y-6 flex flex-col">
      {canBeRemoved && (
        <button 
          onClick={() => onRemove(id)}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors z-10"
          aria-label="Xoá panel"
        >
          <CloseIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
         <div className="sm:col-span-3">
            <label htmlFor={`story-name-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Tên truyện
            </label>
            <input
                id={`story-name-${id}`}
                type="text"
                value={storyName}
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed"
                disabled
            />
         </div>
         <div className="sm:col-span-2">
            <label htmlFor={`chapter-number-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Số chương
            </label>
            <input
                id={`chapter-number-${id}`}
                type="text"
                value={chapterNumber}
                onChange={(e) => onUpdate(id, { chapterNumber: e.target.value })}
                placeholder="VD: 1, 2, 10.5..."
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)] transition-colors duration-200"
                disabled={isLoading}
                autoFocus
            />
         </div>
      </div>
       <div>
            <label htmlFor={`tags-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Thẻ (phân cách bằng dấu phẩy)
            </label>
            <input
                id={`tags-${id}`}
                type="text"
                value={tags}
                onChange={(e) => onUpdate(id, { tags: e.target.value })}
                placeholder="VD: Tiên Hiệp, Trọng Sinh..."
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)] transition-colors duration-200"
                disabled={isLoading}
            />
       </div>
      
      <div className="flex-grow flex flex-col">
        <label htmlFor={`input-text-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Nội dung chương (văn bản gốc)
        </label>
        <textarea
          id={`input-text-${id}`}
          value={inputText}
          onChange={(e) => onUpdate(id, { inputText: e.target.value })}
          placeholder="Dán nội dung truyện cần biên dịch vào đây..."
          className="mt-1 w-full flex-grow h-48 p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)] transition-colors duration-200 resize-y"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
          <button
            onClick={() => onRetry(id)}
            disabled={isLoading}
            className="p-2 rounded-full bg-red-100 hover:bg-red-200 disabled:opacity-50 transition-colors"
            aria-label="Thử lại"
          >
            <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
};