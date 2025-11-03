import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { refineVietnameseText } from './services/geminiService';
import { SpinnerIcon, CopyIcon, CheckIcon, CloseIcon, BookOpenIcon, ChevronDownIcon, PlusIcon, TagIcon, SettingsIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, ArrowLeftIcon, TrashIcon, BookmarkIcon, BookmarkSolidIcon, SaveIcon, CloudIcon, CloudCheckIcon, AlertTriangleIcon } from './components/Icons';
import { loadLastStoryName, saveLastStoryName, loadSettings, saveSettings, AppSettings } from './services/storageService';
import { listenToLibraryChanges, saveLibraryToFirebase } from './services/firebaseService';

// ---- INTERFACES ---- //
interface PanelState {
  id: string;
  storyName: string;
  chapterNumber: string;
  inputText: string;
  tags: string; // Comma-separated tags
  isLoading: boolean;
  error: string | null;
}
interface ChapterData {
  [chapter: string]: string;
}
interface StoryData {
  chapters: ChapterData;
  lastModified: number;
  tags?: string[];
  bookmark?: {
    chapter: string;
    scrollPosition: number; // 0 to 1, representing percentage
  };
}
interface Library {
  [storyName: string]: StoryData;
}
type SyncState = 'idle' | 'syncing' | 'synced' | 'error';


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


// ---- CHILD COMPONENTS ---- //

const TranslationPanel: React.FC<{
  panel: PanelState;
  onUpdate: (id: string, updates: Partial<PanelState>) => void;
  onRemove: (id: string) => void;
  canBeRemoved: boolean;
}> = ({ panel, onUpdate, onRemove, canBeRemoved }) => {
  const { id, storyName, chapterNumber, inputText, tags, isLoading, error } = panel;
  
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl shadow-[var(--shadow-color)] p-6 sm:p-8 w-full lg:w-[520px] flex-shrink-0 relative space-y-6 flex flex-col">
      {canBeRemoved && (
        <button 
          onClick={() => onRemove(id)}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors z-10"
          aria-label="Xoá panel"
        >
          <CloseIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
         <div className="sm:col-span-3">
            <label htmlFor={`story-name-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Tên truyện
            </label>
            <input
                id={`story-name-${id}`}
                type="text"
                value={storyName}
                onChange={(e) => onUpdate(id, { storyName: e.target.value })}
                placeholder="VD: Phàm Nhân Tu Tiên"
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)] transition-colors duration-200"
                disabled={isLoading}
            />
         </div>
         <div className="sm:col-span-2">
            <label htmlFor={`chapter-number-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Số chương
            </label>
            <input
                id={`chapter-number-${id}`}
                type="text"
                value={chapterNumber}
                onChange={(e) => onUpdate(id, { chapterNumber: e.target.value })}
                placeholder="VD: 1, 2, 10.5..."
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)] transition-colors duration-200"
                disabled={isLoading}
            />
         </div>
      </div>
       <div>
            <label htmlFor={`tags-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Thẻ (phân cách bằng dấu phẩy)
            </label>
            <input
                id={`tags-${id}`}
                type="text"
                value={tags}
                onChange={(e) => onUpdate(id, { tags: e.target.value })}
                placeholder="VD: Tiên Hiệp, Trọng Sinh..."
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)] transition-colors duration-200"
                disabled={isLoading}
            />
       </div>
      
      <div className="flex-grow flex flex-col">
        <label htmlFor={`input-text-${id}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Nội dung chương (văn bản gốc)
        </label>
        <textarea
          id={`input-text-${id}`}
          value={inputText}
          onChange={(e) => onUpdate(id, { inputText: e.target.value })}
          placeholder="Dán nội dung truyện cần biên dịch vào đây..."
          className="mt-1 w-full flex-grow h-48 p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-ring)] transition-colors duration-200 resize-y"
          disabled={isLoading}
        />
      </div>

      {error && <p className="text-red-600 text-center bg-red-100 p-3 rounded-lg">{error}</p>}
    </div>
  );
};

const AddPanelButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full h-32 lg:w-48 lg:h-auto lg:min-h-[500px] flex-shrink-0 flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-2xl shadow-lg shadow-[var(--shadow-color)] hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-active)] border-2 border-dashed border-[var(--color-border-primary)] transition-all duration-200 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)] hover:border-[var(--color-accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] self-stretch"
      aria-label="Thêm panel mới"
    >
      <div className="flex lg:flex-col items-center justify-center gap-4 lg:gap-2 text-center">
        <PlusIcon className="w-8 h-8 lg:w-10 lg:h-10" />
        <span className="mt-0 lg:mt-2 block font-semibold">Thêm chương</span>
      </div>
    </button>
  );
};

const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: Partial<AppSettings>) => void;
}> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  if (!isOpen) return null;

  const settingOptions = {
    theme: [ { value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }, { value: 'night', label: 'Ban đêm' } ],
    font: [ { value: 'sans', label: 'Inter' }, { value: 'serif', label: 'Lora' }, { value: 'mono', label: 'Fira Code' } ],
    fontSize: [ { value: 'sm', label: 'Nhỏ' }, { value: 'base', label: 'Vừa' }, { value: 'lg', label: 'Lớn' } ],
  };
  
  return (
      <div
        className="fixed inset-0 bg-[var(--color-backdrop)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
                  <h3 className="text-md font-semibold text-[var(--color-text-secondary)] mb-3">Cỡ chữ</h3>
                  <div className="flex items-center gap-2">
                     {settingOptions.fontSize.map(({value, label}) => (
                          <button
                              key={value}
                              onClick={() => onSettingsChange({ fontSize: value as AppSettings['fontSize'] })}
                              className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${settings.fontSize === value ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}
                          >{label}</button>
                      ))}
                  </div>
              </div>
          </div>
        </div>
      </div>
  )
}

// ---- READER PAGE COMPONENT ---- //
const ReaderPage: React.FC<{
  storyName: string;
  chapterNumber: string;
  library: Library;
  onChapterChange: (story: string, chapter: string) => void;
  onExit: () => void;
  settings: AppSettings;
  onSetBookmark: (story: string, chapter: string, scrollPosition: number) => void;
  onRemoveBookmark: (story: string) => void;
}> = ({ storyName, chapterNumber, library, onChapterChange, onExit, settings, onSetBookmark, onRemoveBookmark }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const chapterListRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  const chapterText = library[storyName]?.chapters?.[chapterNumber] || "Không tìm thấy nội dung chương.";

  const { chapterList, prevChapter, nextChapter } = useMemo(() => {
    const storyData = library[storyName];
    if (!storyData) {
      return { chapterList: [], prevChapter: null, nextChapter: null };
    }
    const chapters = Object.keys(storyData.chapters).sort((a, b) => parseFloat(a) - parseFloat(b));
    const currentIndex = chapters.indexOf(chapterNumber);
    const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
    const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
    return { chapterList: chapters, prevChapter: prev, nextChapter: next };
  }, [storyName, chapterNumber, library]);

  // Restore scroll position
  useEffect(() => {
    const storyData = library[storyName];
    const bookmark = storyData?.bookmark;
    if (contentRef.current && bookmark && bookmark.chapter === chapterNumber) {
        const timer = setTimeout(() => {
            const contentElement = contentRef.current;
            if (contentElement) {
                contentElement.scrollTop = bookmark.scrollPosition * (contentElement.scrollHeight - contentElement.clientHeight);
            }
        }, 100);
        return () => clearTimeout(timer);
    } else if (contentRef.current) {
        contentRef.current.scrollTop = 0;
    }
  }, [storyName, chapterNumber, library]);

  // Save scroll position (debounced)
  useEffect(() => {
    const contentElement = contentRef.current;
    const handleScroll = () => {
        if (scrollTimeoutRef.current) {
            window.clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
            if (contentElement) {
                const { scrollTop, scrollHeight, clientHeight } = contentElement;
                if (scrollHeight > clientHeight) {
                    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
                    onSetBookmark(storyName, chapterNumber, Math.min(1, Math.max(0, scrollPercentage)));
                } else {
                    onSetBookmark(storyName, chapterNumber, 0);
                }
            }
        }, 500);
    };

    contentElement?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        contentElement?.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
            window.clearTimeout(scrollTimeoutRef.current);
        }
    };
  }, [storyName, chapterNumber, onSetBookmark]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (chapterListRef.current && !chapterListRef.current.contains(event.target as Node)) {
            setIsChapterListOpen(false);
        }
    };
    if (isChapterListOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChapterListOpen]);

  const handleCopyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(chapterText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [chapterText]);
  
  const handleChapterSelect = (chapter: string) => {
    onChapterChange(storyName, chapter);
    setIsChapterListOpen(false);
  }

  const handleToggleBookmark = () => {
    const isBookmarked = library[storyName]?.bookmark?.chapter === chapterNumber;
    if (isBookmarked) {
        onRemoveBookmark(storyName);
    } else {
        const contentElement = contentRef.current;
        if (contentElement) {
            const { scrollTop, scrollHeight, clientHeight } = contentElement;
            const scrollPercentage = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
            onSetBookmark(storyName, chapterNumber, Math.min(1, Math.max(0, scrollPercentage)));
        } else {
            onSetBookmark(storyName, chapterNumber, 0); // Fallback to top if ref is not available
        }
    }
  };

  const isBookmarked = library[storyName]?.bookmark?.chapter === chapterNumber;

  const readerStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    const fontMap: Record<AppSettings['font'], string> = { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' };
    const fontSizeMap: Record<AppSettings['fontSize'], string> = { sm: 'var(--font-size-base)', base: 'var(--font-size-lg)', lg: '20px' };
    style.fontFamily = fontMap[settings.font];
    style.fontSize = fontSizeMap[settings.fontSize];
    return style;
  }, [settings.font, settings.fontSize]);

  const ChapterNavigation: React.FC = () => (
    <div className="flex items-center justify-center gap-2 sm:gap-4 p-2 text-[var(--color-text-secondary)]">
        <button
            onClick={() => onChapterChange(storyName, prevChapter!)}
            disabled={!prevChapter}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
            aria-label="Chương trước"
        >
            <ChevronLeftIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">Trước</span>
        </button>
        <div className="relative" ref={chapterListRef}>
          <button
              onClick={() => setIsChapterListOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-active)] transition-colors text-sm font-semibold"
              aria-label="Danh sách chương"
          >
              <ListIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">Danh sách</span>
          </button>
          {isChapterListOpen && (
            <div className="absolute bottom-full mb-2 w-72 max-w-[90vw] bg-[var(--color-bg-secondary)] rounded-lg shadow-xl border border-[var(--color-border-primary)] max-h-80 overflow-y-auto z-10 left-1/2 -translate-x-1/2 p-2 space-y-1">
              {chapterList.map(chap => (
                <button
                  key={chap}
                  onClick={() => handleChapterSelect(chap)}
                  className={`block w-full text-left p-2 rounded-md text-sm transition-colors ${chap === chapterNumber ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] font-semibold' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}
                >
                  Chương {chap}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
            onClick={() => onChapterChange(storyName, nextChapter!)}
            disabled={!nextChapter}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
            aria-label="Chương sau"
        >
            <span className="hidden sm:inline">Sau</span>
            <ChevronRightIcon className="w-5 h-5"/>
        </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)] z-40 flex flex-col animate-fade-in">
        <header className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border-secondary)] flex-shrink-0 w-full max-w-5xl mx-auto">
          <button
            onClick={onExit}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            <span className="hidden sm:inline text-md font-semibold text-[var(--color-text-secondary)]">Thư viện</span>
          </button>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] text-center truncate px-2" title={`${storyName} - Chương ${chapterNumber}`}>
            {`${storyName} - Chương ${chapterNumber}`}
          </h2>
          <div className="flex items-center gap-2">
            <button
                onClick={handleToggleBookmark}
                className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors"
                aria-label={isBookmarked ? "Bỏ đánh dấu chương" : "Đánh dấu chương này"}
            >
                {isBookmarked 
                    ? <BookmarkSolidIcon className="w-6 h-6 text-[var(--color-accent-primary)]" /> 
                    : <BookmarkIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
                }
            </button>
            <button
                onClick={handleCopyToClipboard}
                className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors"
                aria-label="Sao chép"
              >
                {copySuccess ? <CheckIcon className="w-6 h-6 text-green-600" /> : <CopyIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />}
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-grow w-full max-w-4xl mx-auto" ref={contentRef}>
          <pre
            className="text-left leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap"
            style={readerStyle}
          >
            {chapterText}
          </pre>
        </div>

        <footer className="border-t border-[var(--color-border-secondary)] flex-shrink-0 bg-[var(--color-bg-primary)]">
          <ChapterNavigation />
        </footer>
    </div>
  )
}

const SyncStatusIndicator: React.FC<{ status: SyncState }> = ({ status }) => {
  const getStatusContent = () => {
    switch (status) {
      case 'syncing':
        return { icon: <SpinnerIcon className="w-5 h-5 animate-spin" />, text: 'Đang đồng bộ...' };
      case 'synced':
        return { icon: <CloudCheckIcon className="w-5 h-5 text-green-500" />, text: 'Đã đồng bộ' };
      case 'error':
        return { icon: <AlertTriangleIcon className="w-5 h-5 text-red-500" />, text: 'Lỗi đồng bộ' };
      default:
        return { icon: <CloudIcon className="w-5 h-5" />, text: 'Đã kết nối' };
    }
  };

  if (status === 'idle') return null;

  const { icon, text } = getStatusContent();

  return (
    <div className={`fixed bottom-4 right-4 bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 text-sm font-semibold transition-all animate-fade-in z-50`}>
        {icon}
        <span>{text}</span>
    </div>
  );
};

// ---- MAIN APP COMPONENT ---- //

const App: React.FC = () => {
  const [panels, setPanels] = useState<PanelState[]>([createNewPanel()]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [isDirectSaving, setIsDirectSaving] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

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

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark', 'night');
    html.classList.add(settings.theme);

    const sizeMap: Record<AppSettings['fontSize'], string> = { sm: 'var(--font-size-sm)', base: 'var(--font-size-base)', lg: 'var(--font-size-lg)' };
    html.style.fontSize = sizeMap[settings.fontSize];

    const fontMap: Record<AppSettings['font'], string> = { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' };
    document.body.style.setProperty('--font-family', fontMap[settings.font]);

    saveSettings(settings);
  }, [settings]);

  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleSetSyncState = (state: SyncState) => {
    setSyncState(state);
    if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
    }
    if (state === 'synced' || state === 'error') {
        syncTimerRef.current = window.setTimeout(() => {
            setSyncState('idle');
        }, 3000);
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
    
    // Bắt đầu lắng nghe thay đổi từ Firebase
    const unsubscribe = listenToLibraryChanges(loadedLibrary => {
        // Migration để đảm bảo dữ liệu cũ tương thích
        const migratedLibrary = { ...loadedLibrary };
        for (const storyName in migratedLibrary) {
            const story = migratedLibrary[storyName];
            if (!story.tags) story.tags = [];
            if (!story.chapters) story.chapters = {};
        }

        setLibrary(migratedLibrary);

        if (isLibraryLoading) { // Chỉ thực hiện logic này lần đầu
            const lastStoryName = loadLastStoryName();
            let initialPanelState = createNewPanel();

            if (lastStoryName && migratedLibrary[lastStoryName]) {
                const lastStoryData = migratedLibrary[lastStoryName];
                const initialTags = lastStoryData.tags?.join(', ') || '';
                const chapterKeys = Object.keys(lastStoryData.chapters);
                let nextChapterNumber = '1';

                if (chapterKeys.length > 0) {
                    const maxChapter = Math.max(...chapterKeys.map(k => parseFloat(k)).filter(n => !isNaN(n)));
                    if (isFinite(maxChapter)) {
                        nextChapterNumber = (Math.floor(maxChapter) + 1).toString();
                    }
                }
                
                initialPanelState = { ...initialPanelState, storyName: lastStoryName, tags: initialTags, chapterNumber: nextChapterNumber };
            } else if (lastStoryName) {
                initialPanelState = { ...initialPanelState, storyName: lastStoryName, chapterNumber: '1', tags: '' };
            }
            setPanels([initialPanelState]);
            setIsLibraryLoading(false);
        }
    });

    // Hàm cleanup sẽ được gọi khi component bị unmount
    return () => {
        unsubscribe();
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }
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

  const openReader = useCallback((story: string, chapter: string) => {
    setReaderData({ story, chapter });
    setCurrentView('reader');
  }, []);
  
  const handleSetBookmark = useCallback(async (storyName: string, chapter: string, scrollPosition: number) => {
    const newLibrary = JSON.parse(JSON.stringify(library));
    if (newLibrary[storyName]) {
        newLibrary[storyName].bookmark = { chapter, scrollPosition };
        await saveLibrary(newLibrary);
    }
  }, [library]);
  
  const handleRemoveBookmark = useCallback(async (storyName: string) => {
      const newLibrary = JSON.parse(JSON.stringify(library));
      if (newLibrary[storyName] && newLibrary[storyName].bookmark) {
          delete newLibrary[storyName].bookmark;
          await saveLibrary(newLibrary);
      }
  }, [library]);
  
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
    const totalPanels = panels.length;
    const newLibrary = JSON.parse(JSON.stringify(library));

    for (let i = 0; i < totalPanels; i++) {
        const panel = panels[i];
        const trimmedStoryName = panel.storyName.trim();
        saveLastStoryName(trimmedStoryName);

        const trimmedChapterNumber = panel.chapterNumber.trim();
        const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);

        if (!newLibrary[trimmedStoryName]) {
            newLibrary[trimmedStoryName] = { chapters: {}, lastModified: Date.now(), tags: [] };
        }
        newLibrary[trimmedStoryName].chapters[trimmedChapterNumber] = panel.inputText;
        newLibrary[trimmedStoryName].lastModified = Date.now();
        newLibrary[trimmedStoryName].tags = storyTags;
        
        if (i === 0 && currentView === 'editor') {
          openReader(trimmedStoryName, trimmedChapterNumber);
        }
    }
    
    await saveLibrary(newLibrary);
    setIsDirectSaving(false);
    resetPanelsAfterSuccess();
  };


  const startBatchTranslation = async () => {
    for (const panel of panels) {
        if (!panel.storyName.trim() || !panel.chapterNumber.trim() || !panel.inputText.trim()) {
            alert('Vui lòng điền đầy đủ Tên truyện, Số chương, và Nội dung cho tất cả các chương trước khi bắt đầu.');
            return;
        }
    }

    setIsBatchProcessing(true);
    const totalPanels = panels.length;
    let newLibrary = JSON.parse(JSON.stringify(library));

    for (let i = 0; i < totalPanels; i++) {
        const panel = panels[i];
        setBatchProgress(`Đang xử lý chương ${i + 1}/${totalPanels}...`);
        updatePanelState(panel.id, { isLoading: true, error: null });

        const trimmedStoryName = panel.storyName.trim();
        saveLastStoryName(trimmedStoryName);

        try {
            const result = await refineVietnameseText(panel.inputText);

            const trimmedChapterNumber = panel.chapterNumber.trim();
            const storyTags = panel.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            
            newLibrary = JSON.parse(JSON.stringify(newLibrary)); // Re-clone for immutability
            if (!newLibrary[trimmedStoryName]) {
                newLibrary[trimmedStoryName] = { chapters: {}, lastModified: Date.now(), tags: [] };
            }
            newLibrary[trimmedStoryName].chapters[trimmedChapterNumber] = result;
            newLibrary[trimmedStoryName].lastModified = Date.now();
            newLibrary[trimmedStoryName].tags = storyTags;
            
            await saveLibrary(newLibrary); // Save after each successful translation

            updatePanelState(panel.id, { isLoading: false });

            if (i === 0 && currentView === 'editor') {
              openReader(trimmedStoryName, trimmedChapterNumber);
            }

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Lỗi dịch chương này. Quá trình đã dừng lại.';
            updatePanelState(panel.id, { error: errorMessage, isLoading: false });
            setIsBatchProcessing(false);
            setBatchProgress(null);
            alert(errorMessage);
            return;
        }

        if (i < totalPanels - 1) {
            const waitTime = 30000; // 30 seconds
            setBatchProgress(`Đã dịch xong chương ${i + 1}/${totalPanels}. Chờ ${waitTime / 1000} giây...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    setIsBatchProcessing(false);
    setBatchProgress(null);
    resetPanelsAfterSuccess();
  };

  const exitReader = useCallback(() => {
    setCurrentView('editor');
    setReaderData(null);
  }, []);
  
  const toggleStory = (story: string) => {
    setActiveStory(activeStory === story ? null : story);
  };

  const deleteStory = async (storyName: string) => {
    const newLibrary = { ...library };
    delete newLibrary[storyName];
    await saveLibrary(newLibrary);
    if (activeStory === storyName) {
        setActiveStory(null);
    }
  };

  const deleteChapter = async (storyName: string, chapterNumber: string) => {
      const newLibrary = JSON.parse(JSON.stringify(library)); // Deep copy
      if (newLibrary[storyName] && newLibrary[storyName].chapters) {
          delete newLibrary[storyName].chapters[chapterNumber];
          
          if (newLibrary[storyName].bookmark?.chapter === chapterNumber) {
            delete newLibrary[storyName].bookmark;
          }
          
          await saveLibrary(newLibrary);
      }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
        } else if (currentView === 'reader') {
          exitReader();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, currentView, exitReader]);

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    Object.values(library).forEach((story: StoryData) => {
        story.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [library]);

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
                            <>
                                <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                Đang lưu...
                            </>
                         ) : (
                            <>
                                <SaveIcon className="-ml-1 mr-2 h-5 w-5" />
                                Lưu Trực Tiếp
                            </>
                         )}
                      </button>
                      <button
                      onClick={startBatchTranslation}
                      disabled={isFormInvalid || isAnyProcessRunning}
                      className="inline-flex items-center justify-center bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] transition-all duration-200 disabled:bg-[var(--color-accent-disabled)] disabled:cursor-not-allowed disabled:shadow-none w-full sm:w-auto"
                      >
                      {isBatchProcessing ? (
                          <>
                          <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--color-text-accent)]" />
                          {batchProgress || 'Đang xử lý...'}
                          </>
                      ) : (
                          'Biên Dịch và Lưu Toàn Bộ'
                      )}
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
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                          <TagIcon className="w-4 h-4" />
                          <span>Lọc theo thẻ:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          <button onClick={() => setActiveTagFilter(null)} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTagFilter === null ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}>
                              Tất cả
                          </button>
                          {allTags.map(tag => (
                              <button key={tag} onClick={() => setActiveTagFilter(tag)} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTagFilter === tag ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}>
                                  {tag}
                              </button>
                          ))}
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
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {library[story].tags?.map(tag => (
                                            <span key={tag} className="text-xs bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] px-2 py-0.5 rounded-full">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                                <ChevronDownIcon className={`w-5 h-5 transition-transform flex-shrink-0 ml-2 text-[var(--color-text-secondary)] ${activeStory === story ? 'rotate-180' : ''}`}/>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteStory(story); }} 
                                className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors ml-2 flex-shrink-0" 
                                aria-label={`Xoá truyện ${story}`}>
                                <TrashIcon className="w-5 h-5 text-[var(--color-text-muted)] hover:text-red-500" />
                            </button>
                        </div>
                      {activeStory === story && (
                        <div className="p-3 border-t border-[var(--color-border-secondary)] bg-[var(--color-bg-hover)]">
                            {library[story].bookmark && (
                                <button 
                                    onClick={() => openReader(story, library[story].bookmark!.chapter)}
                                    className="w-full flex items-center gap-3 text-left p-2 mb-2 rounded-md bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] hover:bg-opacity-80 transition-all font-semibold"
                                >
                                    <BookmarkSolidIcon className="w-5 h-5 flex-shrink-0"/>
                                    <span>Tiếp tục đọc: Chương {library[story].bookmark!.chapter}</span>
                                </button>
                            )}
                            <div className="space-y-1">
                                {library[story].chapters && Object.keys(library[story].chapters).sort((a, b) => parseFloat(a) - parseFloat(b)).map(chapter => (
                                  <div key={chapter} className="flex justify-between items-center group rounded-md hover:bg-[var(--color-bg-active)]">
                                    <button onClick={() => openReader(story, chapter)} className="flex-grow flex items-center gap-2 text-left p-2 text-[var(--color-text-secondary)]">
                                        {library[story].bookmark?.chapter === chapter ? 
                                            <BookmarkSolidIcon className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0"/> : 
                                            <div className="w-4 h-4 flex-shrink-0" />
                                        }
                                        <span>Chương {chapter}</span>
                                    </button>
                                    <button 
                                      onClick={() => deleteChapter(story, chapter)} 
                                      className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" 
                                      aria-label={`Xoá chương ${chapter}`}>
                                      <TrashIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredLibraryKeys.length === 0 && (
                      <p className="text-[var(--color-text-muted)] text-center py-4">Không tìm thấy truyện nào với thẻ đã chọn.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <footer className="text-center text-sm text-[var(--color-text-muted)] py-6 mt-auto">
            <p>Powered by Gemini API</p>
          </footer>
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
        />
      )}

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
      <SyncStatusIndicator status={syncState} />
    </>
  );
};

export default App;
