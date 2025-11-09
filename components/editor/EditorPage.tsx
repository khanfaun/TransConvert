import React from 'react';
import { SpinnerIcon, SaveIcon, ArrowLeftIcon } from '../Icons';
import { TranslationPanel } from './TranslationPanel';
import { AddPanelButton } from './AddPanelButton';
import { ProgressBar } from '../ui/ProgressBar';
import type { PanelState } from '../../types';

interface EditorPageProps {
    storyName: string;
    onBack: () => void;
    panels: PanelState[];
    onUpdatePanel: (id: string, updates: Partial<PanelState>) => void;
    onAddPanel: () => void;
    onRemovePanel: (id: string) => void;
    onRetryPanel: (id: string) => void;
    isBatchProcessing: boolean;
    isDirectSaving: boolean;
    batchProgress: string | null;
    batchProgressPercent: number;
    onStartProcess: (isTranslation: boolean) => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({
    storyName,
    onBack,
    panels,
    onUpdatePanel,
    onAddPanel,
    onRemovePanel,
    onRetryPanel,
    isBatchProcessing,
    isDirectSaving,
    batchProgress,
    batchProgressPercent,
    onStartProcess,
}) => {
    
    const isFormInvalid = panels.some(p => !p.chapterNumber.trim() || !p.inputText.trim());
    const isAnyProcessRunning = isBatchProcessing || isDirectSaving;

    return (
        <main className="min-h-screen flex flex-col p-4 sm:p-6 animate-fade-in">
            <header className="flex items-center justify-between w-full max-w-5xl mx-auto mb-6">
                <button onClick={onBack} className="flex items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Quay lại">
                    <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
                    <span className="hidden sm:inline text-md font-semibold text-[var(--color-text-secondary)]">Danh sách chương</span>
                </button>
                <div className="text-center flex-grow mx-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Thêm chương mới</h1>
                    <p className="text-[var(--color-text-muted)] mt-1 text-base truncate" title={storyName}>{storyName}</p>
                </div>
                <div className="w-24 flex-shrink-0"></div>
            </header>

            <div className="w-full flex-grow flex flex-col items-center">
                <div className="w-full max-w-xl lg:max-w-full">
                    <div className="lg:overflow-x-auto lg:py-2">
                        <div className="w-full lg:w-auto flex flex-col lg:flex-row items-stretch gap-6 lg:inline-flex">
                            {panels.map((panel) => (
                                <TranslationPanel
                                key={panel.id}
                                panel={panel}
                                onUpdate={onUpdatePanel}
                                onRemove={onRemovePanel}
                                canBeRemoved={panels.length > 1}
                                onRetry={onRetryPanel}
                                />
                            ))}
                            {!isAnyProcessRunning && <AddPanelButton onClick={onAddPanel} />}
                        </div>
                    </div>
                </div>

                <div className="w-full flex justify-center mt-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-lg">
                        <button onClick={() => onStartProcess(false)} disabled={isFormInvalid || isAnyProcessRunning} className="inline-flex items-center justify-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[var(--color-bg-active)] disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed w-full sm:w-auto">
                            {isDirectSaving ? (<><SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5" />Đang lưu...</>) : (<><SaveIcon className="-ml-1 mr-2 h-5 w-5" />Lưu Trực Tiếp</>)}
                        </button>
                        <button onClick={() => onStartProcess(true)} disabled={isFormInvalid || isAnyProcessRunning} className="relative inline-flex items-center justify-center bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent-disabled)] disabled:cursor-not-allowed w-full sm:w-auto overflow-hidden">
                            {isBatchProcessing ? (
                                <>
                                <ProgressBar progress={batchProgressPercent} />
                                <div className="relative z-10 flex items-center">
                                    <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                    <span>{batchProgress || 'Đang xử lý...'}</span>
                                </div>
                                </>
                            ) : ('Biên Dịch và Lưu')}
                        </button>
                    </div>
                </div>
            </div>
            <footer className="text-center text-sm text-[var(--color-text-muted)] py-6 mt-auto"><p>Powered by Gemini API</p></footer>
        </main>
    );
};