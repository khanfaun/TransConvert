import React, { useState, useEffect } from 'react';
import type { Library } from '../../types';
import { CloseIcon, PlusIcon, BookOpenIcon, TagIcon } from '../Icons';

export const AddStoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, tags: string) => void;
  library: Library;
}> = ({ isOpen, onClose, onConfirm, library }) => {
  const [storyName, setStoryName] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStoryName('');
      setTags('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = storyName.trim();
    if (!trimmedName) {
      setError("Tên truyện không được để trống.");
      return;
    }
    if (library[trimmedName]) {
      setError("Tên truyện này đã tồn tại.");
      return;
    }
    onConfirm(trimmedName, tags);
  };

  return (
    <div
      className="fixed inset-0 bg-[var(--color-backdrop)] backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl shadow-[var(--shadow-color)] w-full max-w-md flex flex-col transform animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border-secondary)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Thêm truyện mới</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-active)]" aria-label="Đóng">
            <CloseIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <div>
              <label htmlFor="story-name-input" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                <BookOpenIcon className="w-5 h-5" />
                <span>Tên truyện</span>
              </label>
              <input
                id="story-name-input"
                type="text"
                value={storyName}
                onChange={(e) => setStoryName(e.target.value)}
                className="mt-2 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                autoFocus
                placeholder="VD: Phàm Nhân Tu Tiên"
              />
            </div>
             <div>
              <label htmlFor="tags-input" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                <TagIcon className="w-5 h-5" />
                <span>Thẻ (phân cách bằng dấu phẩy)</span>
              </label>
              <input
                id="tags-input"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-2 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                placeholder="VD: Tiên Hiệp, Trọng Sinh"
              />
            </div>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          <footer className="flex justify-end gap-3 p-4 border-t border-[var(--color-border-secondary)] rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)] transition-colors">Hủy</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-accent-hover)] transition-colors inline-flex items-center gap-2">
                <PlusIcon className="w-5 h-5"/>
                <span>Thêm truyện</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};