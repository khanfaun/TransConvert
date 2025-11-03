import React from 'react';
import type { RetryModalData } from '../../types';
import { CloseIcon, AlertTriangleIcon, RefreshIcon } from '../Icons';

export const RetryModal: React.FC<{
  data: RetryModalData | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ data, onClose, onConfirm }) => {
  if (!data) return null;

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
            Lỗi Biên Dịch
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-active)]" aria-label="Đóng">
            <CloseIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </button>
        </header>
        <div className="p-6 space-y-4">
            <p className="text-[var(--color-text-primary)]">
                Quá trình biên dịch đã thất bại do không nhận được nội dung hợp lệ từ AI. Điều này có thể do lỗi tạm thời.
            </p>
            <p className="font-semibold text-[var(--color-text-secondary)]">
                Bạn có muốn thử biên dịch lại chương này không?
            </p>
        </div>
        <footer className="flex justify-end gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-active)]">Hủy</button>
            <button type="button" onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-accent-hover)] flex items-center gap-2">
                <RefreshIcon className="w-5 h-5" />
                Thử lại
            </button>
        </footer>
      </div>
    </div>
  );
};
