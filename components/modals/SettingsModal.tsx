import React from 'react';
import type { AppSettings } from '../../types';
import { CloseIcon } from '../Icons';

export const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: Partial<AppSettings>) => void;
}> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  if (!isOpen) return null;

  const settingOptions = {
    theme: [ { value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }, { value: 'night', label: 'Ban đêm' } ],
    font: [ { value: 'sans', label: 'Inter' }, { value: 'serif', label: 'Lora' }, { value: 'mono', label: 'Fira Code' } ],
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
          <header className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border-secondary)] flex-shrink-0">
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                Cài đặt
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors"
                aria-label="Đóng"
              >
                <CloseIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
              </button>
          </header>
            
          <div className="p-6 sm:p-8 space-y-6">
              <div>
                  <h3 className="text-md font-semibold text-[var(--color-text-secondary)] mb-3">Giao diện</h3>
                  <div className="flex items-center gap-2">
                      {settingOptions.theme.map(({value, label}) => (
                          <button
                              key={value}
                              onClick={() => onSettingsChange({ theme: value as AppSettings['theme'] })}
                              className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${settings.theme === value ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}
                          >{label}</button>
                      ))}
                  </div>
              </div>
              <div>
                  <h3 className="text-md font-semibold text-[var(--color-text-secondary)] mb-3">Phông chữ</h3>
                  <div className="flex items-center gap-2">
                     {settingOptions.font.map(({value, label}) => (
                          <button
                              key={value}
                              onClick={() => onSettingsChange({ font: value as AppSettings['font'] })}
                              className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${settings.font === value ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}
                          >{label}</button>
                      ))}
                  </div>
              </div>
               <div>
                  <h3 className="text-md font-semibold text-[var(--color-text-secondary)] mb-3">Cỡ chữ (Reader)</h3>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min="14"
                            max="32"
                            step="1"
                            value={settings.fontSize}
                            onChange={(e) => onSettingsChange({ fontSize: parseInt(e.target.value, 10) })}
                            className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent-primary)]"
                        />
                        <span className="font-semibold text-[var(--color-text-primary)] w-10 text-center bg-[var(--color-bg-tertiary)] py-1 rounded-md">{settings.fontSize}px</span>
                    </div>
              </div>
          </div>
        </div>
      </div>
  )
}
