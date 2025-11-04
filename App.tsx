import React, { useState, useCallback, useEffect, useRef } from 'react';
import { loadSettings, saveSettings } from './services/storageService';
import { listenToLibraryChanges, saveLibraryToFirebase } from './services/firebaseService';

import type { Library, AppSettings, RenameModalData, DeleteModalData, SyncState, AppView } from './types';

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


const App: React.FC = () => {
  const [library, setLibrary] = useState<Library>({});
  const [isLibraryLoading, setIsLibraryLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const syncTimerRef = useRef<number | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  
  const [currentView, setCurrentView] = useState<AppView>('library');
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [readerData, setReaderData] = useState<{ story: string; chapter: string } | null>(null);
  
  // Modals State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);
  const [renameModalData, setRenameModalData] = useState<RenameModalData | null>(null);
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
        setIsLibraryLoading(false);
    });
    return () => {
        unsubscribe();
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // ---- NAVIGATION HANDLERS ---- //
  const handleViewChapters = (storyName: string) => {
      setSelectedStory(storyName);
      setCurrentView('chapterList');
  };

  const handleAddNewChapter = (storyName: string) => {
      setSelectedStory(storyName);
      setCurrentView('editor');
  };
  
  const handleOpenReader = useCallback((story: string, chapter: string) => {
    setSelectedStory(story);
    setReaderData({ story, chapter });
    setCurrentView('reader');
  }, []);
  
  const handleBackToLibrary = () => {
      setSelectedStory(null);
      setReaderData(null);
      setCurrentView('library');
  };
  
  const handleBackToChapterList = () => {
    setCurrentView('chapterList');
    setReaderData(null);
  };
  
  const handleSaveComplete = (storyName: string) => {
      setSelectedStory(storyName);
      setCurrentView('chapterList');
  };

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (deleteModalData) setDeleteModalData(null);
        else if (renameModalData) setRenameModalData(null);
        else if (isSettingsModalOpen) setIsSettingsModalOpen(false);
        else if (isAddStoryModalOpen) setIsAddStoryModalOpen(false);
        else if (currentView === 'reader') handleBackToLibrary();
        else if (currentView === 'chapterList' || currentView === 'editor') handleBackToLibrary();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, isAddStoryModalOpen, currentView, renameModalData, deleteModalData, handleBackToChapterList, handleBackToLibrary]);

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
                          onBack={handleBackToLibrary}
                          onRenameChapter={(chapter) => setRenameModalData({type: 'chapter', oldName: chapter, storyName: selectedStory})}
                          onDeleteChapter={(chapter) => setDeleteModalData({type: 'chapter', storyName: selectedStory, chapterNumber: chapter})}
                      />
                  );
              }
              handleBackToLibrary(); // Fallback if story is not found
              return null;
          case 'editor':
              if (selectedStory && library[selectedStory]) {
                  return (
                      <EditorPage
                          storyName={selectedStory}
                          storyData={library[selectedStory]}
                          library={library}
                          onSaveComplete={handleSaveComplete}
                          onBack={handleBackToLibrary}
                          saveLibrary={saveLibrary}
                      />
                  );
              }
              handleBackToLibrary(); // Fallback
              return null;
          case 'reader':
              if (readerData) {
                  return (
                      <ReaderPage
                          storyName={readerData.story}
                          chapterNumber={readerData.chapter}
                          library={library}
                          onChapterChange={handleOpenReader}
                          onExit={handleBackToLibrary}
                          settings={settings}
                          onSetBookmark={handleSetBookmark}
                          onRemoveBookmark={handleRemoveBookmark}
                          onSetReadToIndex={handleSetReadToIndex}
                          onOpenSettings={() => setIsSettingsModalOpen(true)}
                      />
                  );
              }
              handleBackToChapterList(); // Fallback
              return null;
          default:
              setCurrentView('library');
              return null;
      }
  }

  return (
    <>
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