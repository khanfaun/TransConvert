import React, { useState, useEffect } from 'react';
import type { RenameModalData, Library } from '../../types';
import { CloseIcon } from '../Icons';

export const RenameModal: React.FC<{
  data: RenameModalData | null;
  onClose: () => void;
  onConfirm: (newName: string) => void;
  library: Library;
}> = ({ data, onClose, onConfirm, library }) => {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (data) {
      setNewName(data.oldName);
      setError(''); // Reset error when modal opens
    }
  }, [data]);

  if (!data) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || trimmedNewName === data.oldName) {
      onClose();
      return;
    }
    
    // Validation
    if (data.type === 'story' && library[trimmedNewName]) {
      setError("Tên truyện này đã tồn tại.");
      return;
    }
    if (data.type === 'chapter' && data.storyName && library[data.storyName]?.chapters[trimmedNewName]) {
      setError(`Chương "${trimmedNewName}" đã tồn tại.`);
      return;
    }

    onConfirm(trimmedNewName);
  };

  const title = data.type === 'story' ? 'Đổi tên truyện' : 'Đổi số chương';
  const label = data.type === 'story' ? 'Tên truyện mới' : 'Số chương mới';

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
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-active)]" aria-label="Đóng">
            <CloseIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="new-name-input" className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</label>
              <input
                id="new-name-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
          <footer className="flex justify-end gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-active)]">Hủy</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-accent-hover)]">Xác nhận</button>
          </footer>
        </form>
      </div>
    </div>
  );
};
