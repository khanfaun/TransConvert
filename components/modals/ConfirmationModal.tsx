import React from 'react';
import type { DeleteModalData } from '../../types';
import { CloseIcon, AlertTriangleIcon, TrashIcon } from '../Icons';

export const ConfirmationModal: React.FC<{
  data: DeleteModalData | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ data, onClose, onConfirm }) => {
  if (!data) return null;

  const title = data.type === 'story' ? 'Xoá truyện' : 'Xoá chương';
  const message = data.type === 'story' 
    ? `Bạn có chắc chắn muốn xoá vĩnh viễn truyện "${data.storyName}" và toàn bộ các chương trong đó không? Hành động này không thể hoàn tác.`
    : `Bạn có chắc chắn muốn xoá vĩnh viễn chương ${data.chapterNumber} của truyện "${data.storyName}" không?`;

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
          <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
            <AlertTriangleIcon className="w-6 h-6" />
            {title}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-active)]" aria-label="Đóng">
            <CloseIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </button>
        </header>
        <div className="p-6">
          <p className="text-[var(--color-text-primary)]">{message}</p>
        </div>
        <footer className="flex justify-end gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-active)]">Hủy</button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
          >
            <TrashIcon className="w-5 h-5" />
            Xác nhận Xoá
          </button>
        </footer>
      </div>
    </div>
  );
};
