import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { refineVietnameseText } from './services/geminiService';
import { SpinnerIcon, SaveIcon, BookOpenIcon, ChevronDownIcon, TagIcon, SettingsIcon, EditIcon, TrashIcon, BookmarkSolidIcon } from './components/Icons';
import { loadLastStoryName, saveLastStoryName, loadSettings, saveSettings } from './services/storageService';
import { listenToLibraryChanges, saveLibraryToFirebase } from './services/firebaseService';

// Import types
import type { PanelState, Library, StoryData, AppSettings, RenameModalData, RetryModalData, DeleteModalData, SyncState } from './types';

// Import components
import { TranslationPanel } from './components/editor/TranslationPanel';
import { AddPanelButton } from './components/editor/AddPanelButton';
import { SettingsModal } from './components/modals/SettingsModal';
import { RenameModal } from './components/modals/RenameModal';
import { RetryModal } from './components/modals/RetryModal';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { ReaderPage } from './components/reader/ReaderPage';
import { SyncStatusIndicator } from './components/ui/SyncStatusIndicator';
import { ProgressBar } from './components/ui/ProgressBar';

// ---- HELPER FUNCTIONS ---- //
const createNewPanel = (): PanelState => ({
  id: `panel-${Date.now()}-${Math.random()}`,
  storyName: '',
  chapterNumber: '',
  inputText: '',
  tags: '',
  isLoading: false,
  error: null,
});

// ---- MAIN APP COMPONENT ---- //
const App: React.FC = () => {
  const [panels, setPanels] = useState<PanelState[]>([createNewPanel()]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [isDirectSaving, setIsDirectSaving] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchProgressPercent, setBatchProgressPercent] = useState<number>(0);

  const [library, setLibrary] = useState<Library>({});
  const [isLibraryLoading, setIsLibraryLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const syncTimerRef = useRef<number | null>(null);
  
  const [activeStory, setActiveStory] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [currentView, setCurrentView] = useState<'editor' | 'reader'>('editor');
  const [readerData, setReaderData] = useState<{ story: string; chapter: string } | null>(null);
  const [renameModalData, setRenameModalData] = useState<RenameModalData | null>(null);
  const [retryModalData, setRetryModalData] = useState<RetryModalData | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<DeleteModalData | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark', 'night');
    html.classList.add(settings.theme);

    const fontMap: Record<AppSettings['font'], string> = { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' };
    document.body.style.setProperty('--font-family', fontMap[settings.font]);

    saveSettings(settings);
  }, [settings]);

  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleSetSyncState = (state: SyncState) => {
    setSyncState(state);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (state === 'error') {
        syncTimerRef.current = window.setTimeout(() => setSyncState('idle'), 4000);
    }
  };
  
  const saveLibrary = async (newLibrary: Library) => {
    handleSetSyncState('syncing');
    try {
        await saveLibraryToFirebase(newLibrary);
        handleSetSyncState('synced');
    } catch (error) {
        console.error("Firebase save error:", error);
        handleSetSyncState('error');
    }
  };

  useEffect(() => {
    setIsLibraryLoading(true);
    const unsubscribe = listenToLibraryChanges(loadedLibrary => {
        setLibrary(loadedLibrary);
        if (isLibraryLoading) {
            const lastStoryName = loadLastStoryName();
            let initialPanelState = createNewPanel();
            if (lastStoryName && loadedLibrary[lastStoryName]) {
                const lastStoryData = loadedLibrary[lastStoryName];
                const chapterKeys = Object.keys(lastStoryData.chapters);
                const nextChapterNumber = chapterKeys.length > 0
                    ? (Math.floor(Math.max(...chapterKeys.map(k => parseFloat(k)).filter(n => !isNaN(n)))) + 1).toString()
                    : '1';
                initialPanelState = { ...initialPanelState, storyName: lastStoryName, tags: lastStoryData.tags?.join(', ') || '', chapterNumber: nextChapterNumber };
            } else if (lastStoryName) {
                initialPanelState = { ...initialPanelState, storyName: lastStoryName, chapterNumber: '1', tags: '' };
            }
            setPanels([initialPanelState]);
            setIsLibraryLoading(false);
        }
    });
    return () => {
        unsubscribe();
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addPanel = () => {
    const lastPanel = panels[panels.length - 1];
    const newPanel = createNewPanel();
    if (lastPanel) {
      newPanel.storyName = lastPanel.storyName;
      newPanel.tags = lastPanel.tags;
      const lastChapterNum = parseFloat(lastPanel.chapterNumber);
      if (!isNaN(lastChapterNum)) {
        newPanel.chapterNumber = (Math.floor(lastChapterNum) + 1).toString();
      }
    }
    setPanels([...panels, newPanel]);
  };

  const removePanel = (id: string) => {
    if (panels.length > 1) {
      setPanels(panels.filter(p => p.id !== id));
    }
  };

  const updatePanelState = (id: string, updates: Partial<PanelState>) => {
    setPanels(currentPanels =>
      currentPanels.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const handleSetBookmark = useCallback(async (storyName: string, chapter: string, scrollPosition: number) => {
    const newLibrary = JSON.parse(JSON.stringify(library));
    if (newLibrary[storyName]) {
        if (!newLibrary[storyName].bookmark) {
            newLibrary[storyName].bookmark = { chapter, scrollPosition };
        } else {
            newLibrary[storyName].bookmark.chapter = chapter;
            newLibrary[storyName].bookmark.scrollPosition = scrollPosition;
        }
        await saveLibrary(newLibrary);
    }
  }, [library]);

  const openReader = useCallback((story: string, chapter: string) => {
    const newLibrary = JSON.parse(JSON.stringify(library));
    const storyData = newLibrary[story];
    let needsSave = false;
    
    if (storyData) {
        const currentBookmark = storyData.bookmark;
        // Only update if the chapter is actually changing to avoid unnecessary writes.
        if (!currentBookmark || currentBookmark.chapter !== chapter) {
            const newBookmark = currentBookmark || { scrollPosition: 0 };
            newBookmark.chapter = chapter;
            // The core fix: remove the read progress marker when navigating to a new chapter.
            delete newBookmark.readToIndex;
            storyData.bookmark = newBookmark;
            needsSave = true;
        }
    }
    
    if(needsSave) {
        saveLibrary(newLibrary);
    }

    setReaderData({ story, chapter });
    setCurrentView('reader');
  }, [library]);
  
  const handleSetReadToIndex = useCallback(async (storyName: string, chapter: string, readToIndex: number) => {
    const newLibrary = JSON.parse(JSON.stringify(library));
    if (!newLibrary[storyName]) return;

    // Ensure bookmark object exists, or create it if setting progress
    if (!newLibrary[storyName].bookmark) {
        if (readToIndex > 0) {
            newLibrary[storyName].bookmark = { chapter, scrollPosition: 0 };
        } else {
            return; // Nothing to clear if no bookmark exists
        }
    }
    
    const bookmarkRef = newLibrary[storyName].bookmark;
    
    // If readToIndex is 0 or less, clear the progress marker.
    if (readToIndex <= 0) {
        delete bookmarkRef.readToIndex;
    } else {
        bookmarkRef.readToIndex = readToIndex;
        bookmarkRef.chapter = chapter; // Ensure correct chapter is bookmarked
    }
    
    await saveLibrary(newLibrary);
  }, [library]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const handleRemoveBookmark = useCallback(async (storyName: string) => {
      const newLibrary = JSON.parse(JSON.stringify(library));
      if (newLibrary[storyName]?.bookmark) {
          delete newLibrary[storyName].bookmark;
          await saveLibrary(newLibrary);
      }
  }, [library]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const resetPanelsAfterSuccess = () => {
      const lastSuccessfulPanel = panels[panels.length - 1];
      const newPanel = createNewPanel();
      if (lastSuccessfulPanel) {
          newPanel.storyName = lastSuccessfulPanel.storyName;
          newPanel.tags = lastSuccessfulPanel.tags;
          const lastChapterNum = parseFloat(lastSuccessfulPanel.chapterNumber);
          if (!isNaN(lastChapterNum)) {
              newPanel.chapterNumber = (Math.floor(lastChapterNum) + 1).toString();
          }
      }
      setPanels([newPanel]);
  };

  const startDirectSave = async () => {
    for (const panel of panels) {
        if (!panel.storyName.trim() || !panel.chapterNumber.trim() || !panel.inputText.trim()) {
            alert('Vui lòng điền đầy đủ Tên truyện, Số chương, và Nội dung cho tất cả các chương trước khi bắt đầu.');
            return;
        }
    }
    setIsDirectSaving(true);
    const newLibrary = JSON.parse(JSON.stringify(library));
    for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const trimmedStoryName = panel.storyName.trim();
        saveLastStoryName(trimmedStoryName);
        if (!newLibrary[trimmedStoryName]) {
            newLibrary[trimmedStoryName] = { chapters: {}, lastModified: Date.now(), tags: [] };
        }
        newLibrary[trimmedStoryName].chapters[panel.chapterNumber.trim()] = panel.inputText;
        newLibrary[trimmedStoryName].lastModified = Date.now();
        newLibrary[trimmedStoryName].tags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
    await saveLibrary(newLibrary);
    setIsDirectSaving(false);
    resetPanelsAfterSuccess();
  };

  const handleTranslateSinglePanel = async (panelId: string): Promise<boolean> => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return false;

    updatePanelState(panel.id, { isLoading: true, error: null });
    const trimmedStoryName = panel.storyName.trim();
    saveLastStoryName(trimmedStoryName);
    
    // Save content to localStorage before translation
    localStorage.setItem(`pending_translation_${panel.id}`, panel.inputText);

    try {
        const result = await refineVietnameseText(panel.inputText);
        
        if (!result || result.trim() === '') {
            throw new Error("API không trả về nội dung nào.");
        }

        const newLibrary = JSON.parse(JSON.stringify(library));
        const trimmedChapterNumber = panel.chapterNumber.trim();
        const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
        
        if (!newLibrary[trimmedStoryName]) {
            newLibrary[trimmedStoryName] = { chapters: {}, lastModified: Date.now(), tags: [] };
        }
        newLibrary[trimmedStoryName].chapters[trimmedChapterNumber] = result;
        newLibrary[trimmedStoryName].lastModified = Date.now();
        newLibrary[trimmedStoryName].tags = storyTags;
        
        await saveLibrary(newLibrary);
        updatePanelState(panel.id, { isLoading: false });
        
        // Clear saved content on success
        localStorage.removeItem(`pending_translation_${panel.id}`);
        return true;
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
        updatePanelState(panel.id, { isLoading: false, error: errorMessage });
        // Show retry modal on failure only for specific error
        if (errorMessage.includes("API không trả về nội dung nào")) {
            setRetryModalData({ panelId: panel.id });
        }
        return false;
    }
  };
  
  const handleRetryTranslation = async () => {
    if (!retryModalData) return;
    const { panelId } = retryModalData;
    setRetryModalData(null); // Close modal
    await handleTranslateSinglePanel(panelId); // Retry
  };

  const startBatchTranslation = async () => {
    for (const panel of panels) {
        if (!panel.storyName.trim() || !panel.chapterNumber.trim() || !panel.inputText.trim()) {
            alert('Vui lòng điền đầy đủ Tên truyện, Số chương, và Nội dung cho tất cả các chương trước khi bắt đầu.');
            return;
        }
    }
    setIsBatchProcessing(true);
    setBatchProgressPercent(0);
    const totalPanels = panels.length;
    
    // *** FIX: Create a single, cumulative copy of the library before the loop ***
    let cumulativeLibrary = JSON.parse(JSON.stringify(library));

    for (let i = 0; i < totalPanels; i++) {
        const panel = panels[i];
        setBatchProgress(`Đang dịch chương ${panel.chapterNumber} (${i + 1}/${totalPanels})...`);
        updatePanelState(panel.id, { isLoading: true, error: null });
        const trimmedStoryName = panel.storyName.trim();
        saveLastStoryName(trimmedStoryName);

        try {
            const result = await refineVietnameseText(panel.inputText);
            if (!result || result.trim() === '') {
                throw new Error("API không trả về nội dung nào.");
            }

            // *** FIX: Update the cumulative library object instead of creating a new one ***
            const trimmedChapterNumber = panel.chapterNumber.trim();
            const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            
            if (!cumulativeLibrary[trimmedStoryName]) {
                cumulativeLibrary[trimmedStoryName] = { chapters: {}, lastModified: Date.now(), tags: [] };
            }
            cumulativeLibrary[trimmedStoryName].chapters[trimmedChapterNumber] = result;
            cumulativeLibrary[trimmedStoryName].lastModified = Date.now();
            cumulativeLibrary[trimmedStoryName].tags = storyTags;
            
            // Save the entire cumulative object. Each save contains the previous successful results.
            await saveLibrary(cumulativeLibrary);
            
            updatePanelState(panel.id, { isLoading: false });
            
            const progress = Math.round(((i + 1) / totalPanels) * 100);
            setBatchProgressPercent(progress);

            if (i < totalPanels - 1) {
                const waitTime = 30000; // 30 seconds
                setBatchProgress(`Đã xong ${i + 1}/${totalPanels}. Chờ ${waitTime / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
            updatePanelState(panel.id, { isLoading: false, error: errorMessage });
            
            setIsBatchProcessing(false);
            setBatchProgress(null);
            setBatchProgressPercent(0);
            
            if (errorMessage.includes("API không trả về nội dung nào")) {
                setRetryModalData({ panelId: panel.id });
            } else {
                alert(`Lỗi khi dịch chương ${panel.chapterNumber}: ${errorMessage}. Quá trình đã dừng lại.`);
            }
            return;
        }
    }

    setIsBatchProcessing(false);
    setBatchProgress(null);
    setBatchProgressPercent(0);
    resetPanelsAfterSuccess();
  };

  const exitReader = useCallback(() => {
    setCurrentView('editor');
    setReaderData(null);
  }, []);
  
  const toggleStory = (story: string) => setActiveStory(activeStory === story ? null : story);
  const renameStory = (oldStoryName: string) => setRenameModalData({ type: 'story', oldName: oldStoryName });
  const renameChapter = (storyName: string, oldChapterNumber: string) => setRenameModalData({ type: 'chapter', oldName: oldChapterNumber, storyName: storyName });
  
  const deleteStory = async (storyName: string) => {
    const newLibrary = { ...library };
    delete newLibrary[storyName];
    await saveLibrary(newLibrary);
    if (activeStory === storyName) setActiveStory(null);
  };
  
  const deleteChapter = async (storyName: string, chapterNumber: string) => {
      const newLibrary = JSON.parse(JSON.stringify(library));
      if (newLibrary[storyName]?.chapters) {
          delete newLibrary[storyName].chapters[chapterNumber];
          if (newLibrary[storyName].bookmark?.chapter === chapterNumber) delete newLibrary[storyName].bookmark;
          await saveLibrary(newLibrary);
      }
  };
  
  const handleConfirmDelete = () => {
    if (!deleteModalData) return;
    
    if (deleteModalData.type === 'story') {
        deleteStory(deleteModalData.storyName);
    } else if (deleteModalData.type === 'chapter' && deleteModalData.chapterNumber) {
        deleteChapter(deleteModalData.storyName, deleteModalData.chapterNumber);
    }
    
    setDeleteModalData(null);
  };

  const handleConfirmRename = async (newName: string) => {
    if (!renameModalData) return;
    const { type, oldName, storyName } = renameModalData;
    if (type === 'story') {
      const newLibrary = { ...library };
      newLibrary[newName] = newLibrary[oldName];
      delete newLibrary[oldName];
      await saveLibrary(newLibrary);
      if (activeStory === oldName) setActiveStory(newName);
      if (readerData?.story === oldName) setReaderData({ ...readerData, story: newName });
    } else if (type === 'chapter' && storyName) {
      const newLibrary = JSON.parse(JSON.stringify(library));
      const storyData = newLibrary[storyName];
      if (storyData?.chapters) {
        storyData.chapters[newName] = storyData.chapters[oldName];
        delete storyData.chapters[oldName];
        storyData.lastModified = Date.now();
        if (storyData.bookmark?.chapter === oldName) storyData.bookmark.chapter = newName;
        await saveLibrary(newLibrary);
        if (readerData?.story === storyName && readerData?.chapter === oldName) setReaderData({ story: storyName, chapter: newName });
      }
    }
    setRenameModalData(null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (deleteModalData) setDeleteModalData(null);
        else if (retryModalData) setRetryModalData(null);
        else if (renameModalData) setRenameModalData(null);
        else if (isSettingsModalOpen) setIsSettingsModalOpen(false);
        else if (currentView === 'reader') exitReader();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, currentView, exitReader, renameModalData, retryModalData, deleteModalData]);

  // FIX: Explicitly type `story` when iterating to prevent potential 'unknown' type errors from Object.values.
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    Object.values(library).forEach((story: StoryData) => {
        story.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [library]);

  // FIX: Cast library items to StoryData to ensure type-safe access to properties for filtering and sorting.
  const filteredLibraryKeys = useMemo(() => {
    const keys = Object.keys(library);
    const filtered = activeTagFilter
      ? keys.filter(key => {
          const storyData = library[key] as StoryData;
          return storyData?.tags?.includes(activeTagFilter);
        })
      : keys;
    return filtered.sort((a, b) => (library[b] as StoryData).lastModified - (library[a] as StoryData).lastModified);
  }, [library, activeTagFilter]);

  const isFormInvalid = panels.some(p => !p.storyName.trim() || !p.chapterNumber.trim() || !p.inputText.trim());
  const isAnyProcessRunning = isBatchProcessing || isDirectSaving;

  if (isLibraryLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
            <div className="flex flex-col items-center gap-4">
                <SpinnerIcon className="w-12 h-12 text-[var(--color-accent-primary)] animate-spin" />
                <p className="text-[var(--color-text-secondary)] font-semibold">Đang kết nối tới Cloud...</p>
            </div>
        </div>
    );
  }

  return (
    <>
      {currentView === 'editor' && (
        <main className="min-h-screen flex flex-col p-4 sm:p-6">
          <header className="flex items-center justify-between w-full max-w-3xl mx-auto mb-6">
            <div className="text-center flex-grow">
              <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">Biên Dịch Truyện AI</h1>
              <p className="text-[var(--color-text-muted)] mt-2 text-base sm:text-lg">
                Làm mượt câu văn, phân loại và lưu trữ các bản dịch truyện của bạn.
              </p>
            </div>
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors ml-4" aria-label="Cài đặt">
              <SettingsIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </button>
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
                      <button
                        onClick={startDirectSave}
                        disabled={isFormInvalid || isAnyProcessRunning}
                        className="inline-flex items-center justify-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] transition-all duration-200 disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:shadow-none w-full sm:w-auto"
                      >
                         {isDirectSaving ? (
                            <><SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5" />Đang lưu...</>
                         ) : (
                            <><SaveIcon className="-ml-1 mr-2 h-5 w-5" />Lưu Trực Tiếp</>
                         )}
                      </button>
                      <button
                      onClick={startBatchTranslation}
                      disabled={isFormInvalid || isAnyProcessRunning}
                      className="relative inline-flex items-center justify-center bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] transition-all duration-200 disabled:bg-[var(--color-accent-disabled)] disabled:cursor-not-allowed disabled:shadow-none w-full sm:w-auto overflow-hidden"
                      >
                      {isBatchProcessing ? (
                          <>
                            <ProgressBar progress={batchProgressPercent} />
                            <div className="relative z-10 flex items-center">
                                <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--color-text-accent)]" />
                                <span>{batchProgress || 'Đang xử lý...'}</span>
                            </div>
                          </>
                      ) : ( 'Biên Dịch và Lưu Toàn Bộ' )}
                      </button>
                  </div>
              </div>
          </div>

          {Object.keys(library).length > 0 && (
            <div className="w-full max-w-3xl mx-auto mt-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl shadow-[var(--shadow-color)] p-6 sm:p-8">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <BookOpenIcon className="w-6 h-6"/>
                  Thư viện truyện đã dịch
                </h2>
                {allTags.length > 0 && (
                  <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--color-text-secondary)]"><TagIcon className="w-4 h-4" /><span>Lọc theo thẻ:</span></div>
                      <div className="flex flex-wrap gap-2">
                          <button onClick={() => setActiveTagFilter(null)} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTagFilter === null ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}>Tất cả</button>
                          {allTags.map(tag => (<button key={tag} onClick={() => setActiveTagFilter(tag)} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTagFilter === tag ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}>{tag}</button>))}
                      </div>
                  </div>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border-t border-[var(--color-border-secondary)] pt-4">
                  {filteredLibraryKeys.map(story => (
                    <div key={story} className="rounded-lg border border-[var(--color-border-primary)]">
                        <div className="flex justify-between items-center p-3">
                            <button onClick={() => toggleStory(story)} className="flex-grow flex justify-between items-center text-left rounded-md -ml-2 p-2 hover:bg-[var(--color-bg-hover)] transition-colors">
                                <div>
                                    <span className="font-semibold text-[var(--color-text-primary)]">{story}</span>
                                    <div className="flex flex-wrap gap-1 mt-1">{library[story].tags?.map(tag => (<span key={tag} className="text-xs bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] px-2 py-0.5 rounded-full">{tag}</span>))}</div>
                                </div>
                                <ChevronDownIcon className={`w-5 h-5 transition-transform flex-shrink-0 ml-2 text-[var(--color-text-secondary)] ${activeStory === story ? 'rotate-180' : ''}`}/>
                            </button>
                            <div className="flex items-center ml-2 flex-shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); renameStory(story); }} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label={`Sửa tên truyện ${story}`}><EditIcon className="w-5 h-5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)]" /></button>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteModalData({ type: 'story', storyName: story }); }} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label={`Xoá truyện ${story}`}><TrashIcon className="w-5 h-5 text-[var(--color-text-muted)] hover:text-red-500" /></button>
                            </div>
                        </div>
                      {activeStory === story && (
                        <div className="p-3 border-t border-[var(--color-border-secondary)] bg-[var(--color-bg-hover)]">
                            {library[story].bookmark && (<button onClick={() => openReader(story, library[story].bookmark!.chapter)} className="w-full flex items-center gap-3 text-left p-2 mb-2 rounded-md bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] hover:bg-opacity-80 transition-all font-semibold"><BookmarkSolidIcon className="w-5 h-5 flex-shrink-0"/><span>Tiếp tục đọc: Chương {library[story].bookmark!.chapter}</span></button>)}
                            <div className="space-y-1">{library[story].chapters && Object.keys(library[story].chapters).sort((a, b) => parseFloat(a) - parseFloat(b)).map(chapter => (<div key={chapter} className="flex justify-between items-center group rounded-md hover:bg-[var(--color-bg-active)]"><button onClick={() => openReader(story, chapter)} className="flex-grow flex items-center gap-2 text-left p-2 text-[var(--color-text-secondary)]">{library[story].bookmark?.chapter === chapter ? <BookmarkSolidIcon className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0"/> : <div className="w-4 h-4 flex-shrink-0" />}<span>Chương {chapter}</span></button><div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); renameChapter(story, chapter); }} className="p-2 rounded-full" aria-label={`Sửa chương ${chapter}`}><EditIcon className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)]" /></button><button onClick={(e) => { e.stopPropagation(); setDeleteModalData({ type: 'chapter', storyName: story, chapterNumber: chapter }); }} className="p-2 rounded-full" aria-label={`Xoá chương ${chapter}`}><TrashIcon className="w-4 h-4 text-[var(--color-text-muted)] hover:text-red-500" /></button></div></div>))}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredLibraryKeys.length === 0 && (<p className="text-[var(--color-text-muted)] text-center py-4">Không tìm thấy truyện nào với thẻ đã chọn.</p>)}
                </div>
              </div>
            </div>
          )}
          <footer className="text-center text-sm text-[var(--color-text-muted)] py-6 mt-auto"><p>Powered by Gemini API</p></footer>
        </main>
      )}
      {currentView === 'reader' && readerData && (
        <ReaderPage
          storyName={readerData.story}
          chapterNumber={readerData.chapter}
          library={library}
          onChapterChange={openReader}
          onExit={exitReader}
          settings={settings}
          onSetBookmark={handleSetBookmark}
          onRemoveBookmark={handleRemoveBookmark}
          onSetReadToIndex={handleSetReadToIndex}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />
      )}
      <RenameModal data={renameModalData} onClose={() => setRenameModalData(null)} onConfirm={handleConfirmRename} library={library} />
      <RetryModal data={retryModalData} onClose={() => setRetryModalData(null)} onConfirm={handleRetryTranslation} />
      <ConfirmationModal data={deleteModalData} onClose={() => setDeleteModalData(null)} onConfirm={handleConfirmDelete} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onSettingsChange={handleSettingsChange} />
      <SyncStatusIndicator status={syncState} />
    </>
  );
};

export default App;
