import React, { useState, useCallback, useEffect, useRef } from 'react';
import { loadSettings, saveSettings } from './services/storageService';
import { listenToLibraryChanges, saveLibraryToFirebase } from './services/firebaseService';
import { refineVietnameseText } from './services/geminiService';

import type { Library, AppSettings, RenameModalData, DeleteModalData, SyncState, AppView, PanelState } from './types';

import { SettingsModal } from './components/modals/SettingsModal';
import { RenameModal } from './components/modals/RenameModal';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { AddStoryModal } from './components/modals/AddStoryModal';
import { ReaderPage } from './components/reader/ReaderPage';
import { SyncStatusIndicator } from './components/ui/SyncStatusIndicator';
import { SpinnerIcon } from './components/Icons';
import { LibraryPage } from './components/library/LibraryPage';
import { ChapterListPage } from './components/library/ChapterListPage';
import { EditorPage } from './components/editor/EditorPage';
import { ToastNotification } from './components/ui/ToastNotification';


const App: React.FC = () => {
  const [library, setLibrary] = useState<Library>({});
  const [isLibraryLoading, setIsLibraryLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const syncTimerRef = useRef<number | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  
  const [history, setHistory] = useState<AppView[]>(['library']);
  const currentView = history[history.length - 1];

  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [readerData, setReaderData] = useState<{ story: string; chapter: string } | null>(null);
  
  // Modals State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);
  const [renameModalData, setRenameModalData] = useState<RenameModalData | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<DeleteModalData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Editor State (Lifted from EditorPage)
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [isDirectSaving, setIsDirectSaving] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchProgressPercent, setBatchProgressPercent] = useState<number>(0);

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
        setIsLibraryLoading(false);
    });
    return () => {
        unsubscribe();
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // ---- NAVIGATION HANDLERS ---- //
  const navigateTo = (view: AppView) => {
      setHistory(prev => [...prev, view]);
  };
  
  const handleBack = () => {
      setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };
  
  const handleResetToLibrary = () => {
      setSelectedStory(null);
      setReaderData(null);
      setHistory(['library']);
  };

  const handleViewChapters = (storyName: string) => {
      setSelectedStory(storyName);
      navigateTo('chapterList');
  };

  const createNewPanel = (storyName: string, chapterNumber: string, tags: string): PanelState => ({
    id: `panel-${Date.now()}-${Math.random()}`,
    storyName,
    chapterNumber,
    inputText: '',
    tags,
    isLoading: false,
    error: null,
  });

  const handleAddNewChapter = (storyName: string) => {
      const storyData = library[storyName];
      if (!storyData) return;

      const chapterKeys = storyData.chapters ? Object.keys(storyData.chapters) : [];
      const nextChapterNumber = chapterKeys.length > 0
          ? (Math.floor(Math.max(...chapterKeys.map(k => parseFloat(k)).filter(n => !isNaN(n)))) + 1).toString()
          : '1';
      const tags = storyData.tags?.join(', ') || '';
      
      setPanels([createNewPanel(storyName, nextChapterNumber, tags)]);
      setSelectedStory(storyName);
      navigateTo('editor');
  };
  
  const handleOpenReader = useCallback((story: string, chapter: string) => {
    setSelectedStory(story);
    setReaderData({ story, chapter });
    navigateTo('reader');
  }, []);
  
  // ---- DATA HANDLERS ---- //
  const handleSetBookmark = useCallback(async (storyName: string, chapter: string, scrollPosition: number) => {
    const newLibrary = JSON.parse(JSON.stringify(library));
    if (newLibrary[storyName]) {
        let bookmarkRef = newLibrary[storyName].bookmark;
        if (!bookmarkRef) {
          newLibrary[storyName].bookmark = { chapter, scrollPosition };
        } else {
          if (bookmarkRef.chapter !== chapter) delete bookmarkRef.readToIndex;
          bookmarkRef.chapter = chapter;
          bookmarkRef.scrollPosition = scrollPosition;
        }
        await saveLibrary(newLibrary);
    }
  }, [library]);

  const handleSetReadToIndex = useCallback(async (storyName: string, chapter: string, readToIndex: number) => {
    const newLibrary = JSON.parse(JSON.stringify(library));
    if (!newLibrary[storyName]) return;
    if (!newLibrary[storyName].bookmark) {
        if (readToIndex > 0) newLibrary[storyName].bookmark = { chapter, scrollPosition: 0, readToIndex };
        else return;
    } else {
      const bookmarkRef = newLibrary[storyName].bookmark;
      if (readToIndex <= 0) delete bookmarkRef.readToIndex;
      else {
          bookmarkRef.readToIndex = readToIndex;
          bookmarkRef.chapter = chapter;
      }
    }
    await saveLibrary(newLibrary);
  }, [library]);
  
  const handleRemoveBookmark = useCallback(async (storyName: string) => {
      const newLibrary = JSON.parse(JSON.stringify(library));
      if (newLibrary[storyName]?.bookmark) {
          delete newLibrary[storyName].bookmark;
          await saveLibrary(newLibrary);
      }
  }, [library]);
  
  const handleConfirmAddStory = async (name: string, tags: string) => {
    const trimmedName = name.trim();
    if (!trimmedName || library[trimmedName]) return;
    
    const newLibrary = JSON.parse(JSON.stringify(library));
    newLibrary[trimmedName] = {
      chapters: {},
      lastModified: Date.now(),
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
    };
    await saveLibrary(newLibrary);
    setIsAddStoryModalOpen(false);
  };
  
  const deleteStory = async (storyName: string) => {
    const newLibrary = { ...library };
    delete newLibrary[storyName];
    await saveLibrary(newLibrary);
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
    if (deleteModalData.type === 'story') deleteStory(deleteModalData.storyName);
    else if (deleteModalData.type === 'chapter' && deleteModalData.chapterNumber) deleteChapter(deleteModalData.storyName, deleteModalData.chapterNumber);
    setDeleteModalData(null);
  };

  const handleConfirmRename = async (newName: string) => {
    if (!renameModalData) return;
    const { type, oldName, storyName } = renameModalData;
    const trimmedNewName = newName.trim();
    if (type === 'story') {
      const newLibrary = { ...library };
      if (oldName !== trimmedNewName) {
        newLibrary[trimmedNewName] = newLibrary[oldName];
        delete newLibrary[oldName];
      }
      await saveLibrary(newLibrary);
      if (selectedStory === oldName) setSelectedStory(trimmedNewName);
      if (readerData?.story === oldName) setReaderData({ ...readerData, story: trimmedNewName });
    } else if (type === 'chapter' && storyName) {
      const newLibrary = JSON.parse(JSON.stringify(library));
      const storyData = newLibrary[storyName];
      if (storyData?.chapters && oldName !== trimmedNewName) {
        storyData.chapters[trimmedNewName] = storyData.chapters[oldName];
        delete storyData.chapters[oldName];
        storyData.lastModified = Date.now();
        if (storyData.bookmark?.chapter === oldName) storyData.bookmark.chapter = trimmedNewName;
        await saveLibrary(newLibrary);
        if (readerData?.story === storyName && readerData?.chapter === oldName) setReaderData({ story: storyName, chapter: trimmedNewName });
      }
    }
    setRenameModalData(null);
  };

  // ---- EDITOR LOGIC (LIFTED) ---- //
  const updatePanelState = (id: string, updates: Partial<PanelState>) => {
    setPanels(currentPanels =>
        currentPanels.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const addPanel = () => {
    if (!selectedStory) return;
    const lastPanel = panels[panels.length - 1];
    const lastChapterNum = parseFloat(lastPanel.chapterNumber);
    const nextChapterNum = !isNaN(lastChapterNum) ? (Math.floor(lastChapterNum) + 1).toString() : '';
    const newPanel = createNewPanel(selectedStory, nextChapterNum, lastPanel.tags);
    setPanels([...panels, newPanel]);
  };

  const removePanel = (id: string) => {
    if (panels.length > 1) {
        setPanels(panels.filter(p => p.id !== id));
    }
  };

  const handleTranslateSinglePanel = async (panelId: string): Promise<boolean> => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.inputText.trim() || !selectedStory) return false;

    updatePanelState(panel.id, { isLoading: true, error: null });
    try {
        const result = await refineVietnameseText(panel.inputText);
        if (!result || result.trim() === '') {
            throw new Error("API không trả về nội dung nào.");
        }
        const newLibrary = JSON.parse(JSON.stringify(library));
        const trimmedChapterNumber = panel.chapterNumber.trim();
        const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
        
        newLibrary[selectedStory].chapters[trimmedChapterNumber] = result;
        newLibrary[selectedStory].lastModified = Date.now();
        newLibrary[selectedStory].tags = storyTags;
        
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

  const handleStartProcess = async (isTranslation: boolean) => {
    if (!selectedStory) return;

    for (const panel of panels) {
        if (!panel.chapterNumber.trim() || !panel.inputText.trim()) {
            alert('Vui lòng điền đầy đủ Số chương và Nội dung cho tất cả các panel.');
            return;
        }
    }

    isTranslation ? setIsBatchProcessing(true) : setIsDirectSaving(true);
    setBatchProgressPercent(0);
    const totalPanels = panels.length;
    let cumulativeLibrary = JSON.parse(JSON.stringify(library));

    for (let i = 0; i < totalPanels; i++) {
        const panel = panels[i];
        setBatchProgress(`Đang xử lý chương ${panel.chapterNumber} (${i + 1}/${totalPanels})...`);
        updatePanelState(panel.id, { isLoading: true, error: null });

        try {
            const result = isTranslation 
                ? await refineVietnameseText(panel.inputText) 
                : panel.inputText;

            if (isTranslation && (!result || result.trim() === '')) {
                throw new Error("API không trả về nội dung nào.");
            }

            const trimmedChapterNumber = panel.chapterNumber.trim();
            const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            
            if (!cumulativeLibrary[selectedStory].chapters) {
              cumulativeLibrary[selectedStory].chapters = {};
            }
            cumulativeLibrary[selectedStory].chapters[trimmedChapterNumber] = result;
            cumulativeLibrary[selectedStory].lastModified = Date.now();
            cumulativeLibrary[selectedStory].tags = storyTags;
            
            await saveLibrary(cumulativeLibrary);
            
            updatePanelState(panel.id, { isLoading: false });
            
            const progress = Math.round(((i + 1) / totalPanels) * 100);
            setBatchProgressPercent(progress);

            if (isTranslation && i < totalPanels - 1) {
                const waitTime = 30000;
                setBatchProgress(`Đã xong ${i + 1}/${totalPanels}. Chờ ${waitTime / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "Lỗi không xác định.";
            updatePanelState(panel.id, { isLoading: false, error: errorMessage });
            setIsBatchProcessing(false);
            setIsDirectSaving(false);
            setBatchProgress(null);
            setBatchProgressPercent(0);
            alert(`Lỗi khi xử lý chương ${panel.chapterNumber}: ${errorMessage}. Quá trình đã dừng lại.`);
            return;
        }
    }

    setIsBatchProcessing(false);
    setIsDirectSaving(false);
    setBatchProgress(null);
    setBatchProgressPercent(0);

    const processAction = isTranslation ? 'dịch xong' : 'lưu';
    if (totalPanels === 1) {
        const chapterNumber = panels[0].chapterNumber.trim();
        setToastMessage(`Đã ${processAction} chương ${chapterNumber}!`);
    } else {
        setToastMessage(`Đã ${processAction} ${totalPanels} chương thành công!`);
    }

    handleBack();
  };


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (deleteModalData) setDeleteModalData(null);
        else if (renameModalData) setRenameModalData(null);
        else if (isSettingsModalOpen) setIsSettingsModalOpen(false);
        else if (isAddStoryModalOpen) setIsAddStoryModalOpen(false);
        else handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, isAddStoryModalOpen, renameModalData, deleteModalData, handleBack]);

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
  
  const renderContent = () => {
      switch(currentView) {
          case 'library':
              return (
                  <LibraryPage
                      library={library}
                      onViewChapters={handleViewChapters}
                      onAddNewChapter={handleAddNewChapter}
                      onOpenReader={handleOpenReader}
                      onOpenAddStoryModal={() => setIsAddStoryModalOpen(true)}
                      onRenameStory={(story) => setRenameModalData({type: 'story', oldName: story})}
                      onDeleteStory={(story) => setDeleteModalData({type: 'story', storyName: story})}
                      onOpenSettings={() => setIsSettingsModalOpen(true)}
                  />
              );
          case 'chapterList':
              if (selectedStory && library[selectedStory]) {
                  return (
                      <ChapterListPage
                          storyName={selectedStory}
                          storyData={library[selectedStory]}
                          onOpenReader={handleOpenReader}
                          onBack={handleBack}
                          onAddNewChapter={handleAddNewChapter}
                          onRenameChapter={(chapter) => setRenameModalData({type: 'chapter', oldName: chapter, storyName: selectedStory})}
                          onDeleteChapter={(chapter) => setDeleteModalData({type: 'chapter', storyName: selectedStory, chapterNumber: chapter})}
                      />
                  );
              }
              handleResetToLibrary(); // Fallback if story is not found
              return null;
          case 'editor':
              if (selectedStory && library[selectedStory]) {
                  return (
                      <EditorPage
                          storyName={selectedStory}
                          onBack={handleBack}
                          panels={panels}
                          onUpdatePanel={updatePanelState}
                          onAddPanel={addPanel}
                          onRemovePanel={removePanel}
                          onRetryPanel={handleTranslateSinglePanel}
                          isBatchProcessing={isBatchProcessing}
                          isDirectSaving={isDirectSaving}
                          batchProgress={batchProgress}
                          batchProgressPercent={batchProgressPercent}
                          onStartProcess={handleStartProcess}
                      />
                  );
              }
              handleResetToLibrary(); // Fallback
              return null;
          case 'reader':
              if (readerData) {
                  return (
                      <ReaderPage
                          storyName={readerData.story}
                          chapterNumber={readerData.chapter}
                          library={library}
                          onChapterChange={handleOpenReader}
                          onBack={handleBack}
                          settings={settings}
                          onSetBookmark={handleSetBookmark}
                          onRemoveBookmark={handleRemoveBookmark}
                          onSetReadToIndex={handleSetReadToIndex}
                          onOpenSettings={() => setIsSettingsModalOpen(true)}
                          onAddNewChapter={handleAddNewChapter}
                      />
                  );
              }
              handleBack(); // Fallback
              return null;
          default:
              setHistory(['library']);
              return null;
      }
  }

  return (
    <>
      {toastMessage && (
          <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
      {renderContent()}
      <RenameModal data={renameModalData} onClose={() => setRenameModalData(null)} onConfirm={handleConfirmRename} library={library} />
      <ConfirmationModal data={deleteModalData} onClose={() => setDeleteModalData(null)} onConfirm={handleConfirmDelete} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onSettingsChange={handleSettingsChange} />
      <AddStoryModal isOpen={isAddStoryModalOpen} onClose={() => setIsAddStoryModalOpen(false)} onConfirm={handleConfirmAddStory} library={library} />
      <SyncStatusIndicator status={syncState} />
    </>
  );
};

export default App;