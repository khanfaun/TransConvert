import React from 'react';

export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="absolute inset-0 w-full bg-transparent rounded-lg overflow-hidden">
    <div
      className="h-full bg-[var(--color-accent-primary)] opacity-30 transition-all duration-500 ease-out"
      style={{ width: `${progress}%` }}
    />
  </div>
);
