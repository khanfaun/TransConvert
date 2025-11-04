import React, { useEffect } from 'react';
import { CheckIcon } from '../Icons';

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ message, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [onClose, duration]);

  return (
    <div 
      className="fixed top-5 left-1/2 z-[100] animate-toast-in-out"
      role="alert"
    >
      <div className="flex items-center gap-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-semibold px-4 py-3 rounded-full shadow-lg border border-[var(--color-border-primary)]">
        <CheckIcon className="w-5 h-5 text-green-500" />
        <span>{message}</span>
      </div>
    </div>
  );
};
