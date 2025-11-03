import React from 'react';
import type { SyncState } from '../../types';
import { AlertTriangleIcon } from '../Icons';

export const SyncStatusIndicator: React.FC<{ status: SyncState }> = ({ status }) => {
  if (status !== 'error') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-[var(--color-bg-secondary)] shadow-lg flex items-center p-3 rounded-full transition-all animate-fade-in z-50">
        <AlertTriangleIcon className="w-5 h-5 text-red-500" />
    </div>
  );
};
