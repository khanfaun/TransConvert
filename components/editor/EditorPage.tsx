import React, { useState } from 'react';
import { refineVietnameseText } from '../../services/geminiService';
import { addChaptersToTranslationQueue, TranslationTask } from '../../services/firebaseService';
import { SpinnerIcon, SaveIcon, ArrowLeftIcon } from '../Icons';
import { TranslationPanel } from './TranslationPanel';
import { AddPanelButton } from './AddPanelButton';
import { ToastNotification } from '../ui/ToastNotification';
import type { PanelState, Library, StoryData } from '../../types';

const createNewPanel = (storyName: string, chapterNumber: string, tags: string): PanelState => ({
  id: `panel-${Date.now()}-${Math.random()}`,
  storyName,
  chapterNumber,
  inputText: '',
  tags,
  isLoading: false,
  error: null,
});

export const EditorPage: React.FC<{
    storyName: string;
    storyData: StoryData;
    library: Library;
    onBack: () => void;
    saveLibrary: (newLibrary: Library) => Promise<void>;
}> = ({ storyName, storyData, library, onBack, saveLibrary }) => {
    
    const getInitialPanels = () => {
        const chapterKeys = storyData.chapters ? Object.keys(storyData.chapters) : [];
        const nextChapterNumber = chapterKeys.length > 0
            ? (Math.floor(Math.max(...chapterKeys.map(k => parseFloat(k)).filter(n => !isNaN(n)))) + 1).toString()
            : '1';
        const tags = storyData.tags?.join(', ') || '';
        return [createNewPanel(storyName, nextChapterNumber, tags)];
    };

    const [panels, setPanels] = useState<PanelState[]>(getInitialPanels);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isDirectSaving, setIsDirectSaving] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const updatePanelState = (id: string, updates: Partial<PanelState>) => {
        setPanels(currentPanels =>
            currentPanels.map(p => (p.id === id ? { ...p, ...updates } : p))
        );
    };

    const addPanel = () => {
        const lastPanel = panels[panels.length - 1];
        const lastChapterNum = parseFloat(lastPanel.chapterNumber);
        const nextChapterNum = !isNaN(lastChapterNum) ? (Math.floor(lastChapterNum) + 1).toString() : '';
        const newPanel = createNewPanel(storyName, nextChapterNum, lastPanel.tags);
        setPanels([...panels, newPanel]);
    };

    const removePanel = (id: string) => {
        if (panels.length > 1) {
            setPanels(panels.filter(p => p.id !== id));
        }
    };
    
    // This function remains for potential direct use or retry, but is not the main flow
    const handleTranslateSinglePanel = async (panelId: string): Promise<boolean> => {
        const panel = panels.find(p => p.id === panelId);
        if (!panel || !panel.inputText.trim()) return false;

        updatePanelState(panel.id, { isLoading: true, error: null });
        try {
            const result = await refineVietnameseText(panel.inputText);
            if (!result || result.trim() === '') {
                throw new Error("API không trả về nội dung nào.");
            }
            const newLibrary = JSON.parse(JSON.stringify(library));
            const trimmedChapterNumber = panel.chapterNumber.trim();
            const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            
            newLibrary[storyName].chapters[trimmedChapterNumber] = result;
            newLibrary[storyName].lastModified = Date.now();
            newLibrary[storyName].tags = storyTags;
            
            await saveLibrary(newLibrary);
            updatePanelState(panel.id, { isLoading: false });
            return true;
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
            updatePanelState(panel.id, { isLoading: false, error: errorMessage });
            return false;
        }
    };
    
    // NEW: Handles submitting to the queue
    const handleSubmitToQueue = async () => {
        for (const panel of panels) {
            if (!panel.chapterNumber.trim() || !panel.inputText.trim()) {
                alert('Vui lòng điền đầy đủ Số chương và Nội dung cho tất cả các panel.');
                return;
            }
        }
        
        setIsSubmitting(true);
        try {
            const tasks: TranslationTask[] = panels.map(p => ({
                storyName: storyName,
                chapterNumber: p.chapterNumber.trim(),
                rawText: p.inputText,
                tags: p.tags.split(',').map(tag => tag.trim()).filter(Boolean)
            }));

            await addChaptersToTranslationQueue(tasks);

            setToastMessage(`Đã gửi ${tasks.length} chương vào hàng đợi xử lý!`);
            setPanels(getInitialPanels()); // Reset panels
            onBack(); // Go back to library to see results appear

        } catch (error) {
            console.error("Error submitting to queue:", error);
            alert("Đã có lỗi xảy ra khi gửi yêu cầu dịch. Vui lòng thử lại.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // MODIFIED: `startProcess` is now only for direct saving
    const startDirectSave = async () => {
        for (const panel of panels) {
            if (!panel.chapterNumber.trim() || !panel.inputText.trim()) {
                alert('Vui lòng điền đầy đủ Số chương và Nội dung cho tất cả các panel.');
                return;
            }
        }

        setIsDirectSaving(true);
        let cumulativeLibrary = JSON.parse(JSON.stringify(library));

        for (const panel of panels) {
            updatePanelState(panel.id, { isLoading: true, error: null });
            
            const trimmedChapterNumber = panel.chapterNumber.trim();
            const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            
            if (!cumulativeLibrary[storyName].chapters) {
              cumulativeLibrary[storyName].chapters = {};
            }
            cumulativeLibrary[storyName].chapters[trimmedChapterNumber] = panel.inputText;
            cumulativeLibrary[storyName].lastModified = Date.now();
            cumulativeLibrary[storyName].tags = storyTags;
        }

        try {
            await saveLibrary(cumulativeLibrary);
            setToastMessage(`Đã lưu trực tiếp ${panels.length} chương thành công!`);
            setPanels(getInitialPanels());
        } catch (error) {
            console.error("Direct save error:", error);
            alert("Lỗi khi lưu trực tiếp.");
        } finally {
            setIsDirectSaving(false);
        }
    };

    const isFormInvalid = panels.some(p => !p.chapterNumber.trim() || !p.inputText.trim());
    const isAnyProcessRunning = isSubmitting || isDirectSaving;

    return (
        <>
            <main className="min-h-screen flex flex-col p-4 sm:p-6 animate-fade-in">
                {toastMessage && (
                    <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />
                )}
                <header className="flex items-center justify-between w-full max-w-5xl mx-auto mb-6">
                    <button onClick={onBack} className="flex items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Quay lại">
                        <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        <span className="hidden sm:inline text-md font-semibold text-[var(--color-text-secondary)]">Thư viện</span>
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
                                    onUpdate={updatePanelState}
                                    onRemove={removePanel}
                                    canBeRemoved={panels.length > 1}
                                    onRetry={handleTranslateSinglePanel}
                                    />
                                ))}
                                {!isAnyProcessRunning && <AddPanelButton onClick={addPanel} />}
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex justify-center mt-6">
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-lg">
                            <button onClick={startDirectSave} disabled={isFormInvalid || isAnyProcessRunning} className="inline-flex items-center justify-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[var(--color-bg-active)] disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed w-full sm:w-auto">
                                {isDirectSaving ? (<><SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5" />Đang lưu...</>) : (<><SaveIcon className="-ml-1 mr-2 h-5 w-5" />Lưu Trực Tiếp</>)}
                            </button>
                            <button onClick={handleSubmitToQueue} disabled={isFormInvalid || isAnyProcessRunning} className="relative inline-flex items-center justify-center bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent-disabled)] disabled:cursor-not-allowed w-full sm:w-auto overflow-hidden">
                                {isSubmitting ? (
                                    <>
                                    <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                    <span>Đang gửi...</span>
                                    </>
                                ) : ('Gửi đi Dịch')}
                            </button>
                        </div>
                    </div>
                </div>
                <footer className="text-center text-sm text-[var(--color-text-muted)] py-6 mt-auto"><p>Powered by Gemini API</p></footer>
            </main>
        </>
    );
};
