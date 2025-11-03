import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { refineVietnameseText } from './services/geminiService';
import { SpinnerIcon, CopyIcon, CheckIcon, CloseIcon, BookOpenIcon, ChevronDownIcon, PlusIcon, TagIcon, SettingsIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, ArrowLeftIcon, TrashIcon, BookmarkIcon, BookmarkSolidIcon, SaveIcon, CloudIcon, CloudCheckIcon, AlertTriangleIcon, EditIcon, RefreshIcon } from './components/Icons';
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
    readToIndex?: number; // Index of the paragraph read up to
  };
}
interface Library {
  [storyName: string]: StoryData;
}
type SyncState = 'idle' | 'syncing' | 'synced' | 'error';
interface RenameModalData {
  type: 'story' | 'chapter';
  oldName: string;
  storyName?: string; // For chapter rename
}
interface RetryModalData {
    panelId: string;
}

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
  onRetry: (id: string) => void;
}> = ({ panel, onUpdate, onRemove, canBeRemoved, onRetry }) => {
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
          <button
            onClick={() => onRetry(id)}
            disabled={isLoading}
            className="p-2 rounded-full bg-red-100 hover:bg-red-200 disabled:opacity-50 transition-colors"
            aria-label="Thử lại"
          >
            <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
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

const RenameModal: React.FC<{
  data: RenameModalData | null;
  onClose: () => void;
  onConfirm: (newName: string) => void;
  library: Library;
}> = ({ data, onClose, onConfirm, library }) => {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (data) {
      setNewName(data.oldName);
      setError(''); // Reset error when modal opens
    }
  }, [data]);

  if (!data) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || trimmedNewName === data.oldName) {
      onClose();
      return;
    }
    
    // Validation
    if (data.type === 'story' && library[trimmedNewName]) {
      setError("Tên truyện này đã tồn tại.");
      return;
    }
    if (data.type === 'chapter' && data.storyName && library[data.storyName]?.chapters[trimmedNewName]) {
      setError(`Chương "${trimmedNewName}" đã tồn tại.`);
      return;
    }

    onConfirm(trimmedNewName);
  };

  const title = data.type === 'story' ? 'Đổi tên truyện' : 'Đổi số chương';
  const label = data.type === 'story' ? 'Tên truyện mới' : 'Số chương mới';

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
        <header className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border-secondary)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-active)]" aria-label="Đóng">
            <CloseIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="new-name-input" className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</label>
              <input
                id="new-name-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
          <footer className="flex justify-end gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-active)]">Hủy</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-accent-hover)]">Xác nhận</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

const RetryModal: React.FC<{
  data: RetryModalData | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ data, onClose, onConfirm }) => {
  if (!data) return null;

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
        <header className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border-secondary)]">
          <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
            <AlertTriangleIcon className="w-6 h-6" />
            Lỗi Biên Dịch
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-active)]" aria-label="Đóng">
            <CloseIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </button>
        </header>
        <div className="p-6 space-y-4">
            <p className="text-[var(--color-text-primary)]">
                Quá trình biên dịch đã thất bại do không nhận được nội dung hợp lệ từ AI. Điều này có thể do lỗi tạm thời.
            </p>
            <p className="font-semibold text-[var(--color-text-secondary)]">
                Bạn có muốn thử biên dịch lại chương này không?
            </p>
        </div>
        <footer className="flex justify-end gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-active)]">Hủy</button>
            <button type="button" onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-accent-hover)] flex items-center gap-2">
                <RefreshIcon className="w-5 h-5" />
                Thử lại
            </button>
        </footer>
      </div>
    </div>
  );
};


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
  onSetReadToIndex: (story: string, chapter: string, index: number) => void;
  onOpenSettings: () => void;
}> = ({ storyName, chapterNumber, library, onChapterChange, onExit, settings, onSetBookmark, onRemoveBookmark, onSetReadToIndex, onOpenSettings }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const chapterListRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  const [hoveredParagraph, setHoveredParagraph] = useState<number | null>(null);
  const storyData = library[storyName];
  const bookmark = storyData?.bookmark;

  const { chapterText, paragraphs } = useMemo(() => {
    const text = storyData?.chapters?.[chapterNumber] || "Không tìm thấy nội dung chương.";
    const para = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
    return { chapterText: text, paragraphs: para };
  }, [storyData, chapterNumber]);

  const { chapterList, prevChapter, nextChapter } = useMemo(() => {
    if (!storyData) return { chapterList: [], prevChapter: null, nextChapter: null };
    const chapters = Object.keys(storyData.chapters).sort((a, b) => parseFloat(a) - parseFloat(b));
    const currentIndex = chapters.indexOf(chapterNumber);
    const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
    const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
    return { chapterList: chapters, prevChapter: prev, nextChapter: next };
  }, [storyName, chapterNumber, library]);

  // Restore scroll position
  useEffect(() => {
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
        if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = window.setTimeout(() => {
            if (contentElement) {
                const { scrollTop, scrollHeight, clientHeight } = contentElement;
                const scrollPercentage = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
                onSetBookmark(storyName, chapterNumber, Math.min(1, Math.max(0, scrollPercentage)));
            }
        }, 500);
    };
    contentElement?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        contentElement?.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, [storyName, chapterNumber, onSetBookmark]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (chapterListRef.current && !chapterListRef.current.contains(event.target as Node)) setIsChapterListOpen(false);
    };
    if (isChapterListOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    if (bookmark?.chapter === chapterNumber) {
        onRemoveBookmark(storyName);
    } else {
        const contentElement = contentRef.current;
        const scrollPercentage = contentElement && contentElement.scrollHeight > contentElement.clientHeight 
            ? contentElement.scrollTop / (contentElement.scrollHeight - contentElement.clientHeight) : 0;
        onSetBookmark(storyName, chapterNumber, Math.min(1, Math.max(0, scrollPercentage)));
    }
  };

  const handleMouseEnterPara = (index: number) => {
    setHoveredParagraph(index);
  };
  const handleMouseLeavePara = () => {
    setHoveredParagraph(null);
  };
  
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
          <div className="flex items-center gap-1 sm:gap-2">
            <button
                onClick={handleToggleBookmark}
                className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors"
                aria-label={bookmark?.chapter === chapterNumber ? "Bỏ đánh dấu chương" : "Đánh dấu chương này"}
            >
                {bookmark?.chapter === chapterNumber 
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
             <button
                onClick={onOpenSettings}
                className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors"
                aria-label="Cài đặt"
            >
                <SettingsIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-grow w-full max-w-4xl mx-auto reader-content" ref={contentRef}>
            <div
              className="text-left leading-relaxed text-[var(--color-text-primary)]"
              style={readerStyle}
            >
              {paragraphs.map((p, index) => {
                  const isRead = bookmark?.chapter === chapterNumber && bookmark?.readToIndex != null && index < bookmark.readToIndex;
                  return (
                    <p key={index}
                      onMouseEnter={() => handleMouseEnterPara(index)}
                      onMouseLeave={handleMouseLeavePara}
                      onClick={() => !isRead && onSetReadToIndex(storyName, chapterNumber, index + 1)}
                      className={`transition-all duration-300 ${
                        isRead 
                        ? 'opacity-40' 
                        : 'opacity-100 cursor-pointer'
                      } ${
                        hoveredParagraph === index && !isRead ? 'underline decoration-from-font' : ''
                      }`}
                      style={{ whiteSpace: 'pre-wrap', marginBottom: '1em', textUnderlineOffset: '4px' }}
                    >
                      {p}
                    </p>
                  );
              })}
            </div>
        </div>

        <footer className="border-t border-[var(--color-border-secondary)] flex-shrink-0 bg-[var(--color-bg-primary)]">
          <ChapterNavigation />
        </footer>
    </div>
  )
}

const SyncStatusIndicator: React.FC<{ status: SyncState }> = ({ status }) => {
  if (status !== 'error') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-[var(--color-bg-secondary)] shadow-lg flex items-center p-3 rounded-full transition-all animate-fade-in z-50">
        <AlertTriangleIcon className="w-5 h-5 text-red-500" />
    </div>
  );
};

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="absolute inset-0 w-full bg-transparent rounded-lg overflow-hidden">
    <div
      className="h-full bg-[var(--color-accent-primary)] opacity-30 transition-all duration-500 ease-out"
      style={{ width: `${progress}%` }}
    />
  </div>
);


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

  const openReader = useCallback((story: string, chapter: string) => {
    setReaderData({ story, chapter });
    setCurrentView('reader');
  }, []);
  
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
  }, [library]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetReadToIndex = useCallback(async (storyName: string, chapter: string, readToIndex: number) => {
    const newLibrary = JSON.parse(JSON.stringify(library));
    if (newLibrary[storyName]) {
        if (!newLibrary[storyName].bookmark) {
            newLibrary[storyName].bookmark = { chapter, scrollPosition: 0, readToIndex };
        } else {
            newLibrary[storyName].bookmark.readToIndex = readToIndex;
            newLibrary[storyName].bookmark.chapter = chapter; // Ensure correct chapter is bookmarked
        }
        await saveLibrary(newLibrary);
    }
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
        updatePanelState(panel.id, { isLoading: false });
        // Show retry modal on failure
        setRetryModalData({ panelId: panel.id });
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

    for (let i = 0; i < totalPanels; i++) {
        const panel = panels[i];
        setBatchProgress(`Đang dịch chương ${panel.chapterNumber} (${i + 1}/${totalPanels})...`);
        
        const success = await handleTranslateSinglePanel(panel.id);
        
        if (!success) {
            setIsBatchProcessing(false);
            setBatchProgress(null);
            setBatchProgressPercent(0);
            // Don't show alert, modal is already shown
            return;
        }
        
        const progress = Math.round(((i + 1) / totalPanels) * 100);
        setBatchProgressPercent(progress);

        if (i < totalPanels - 1) {
            const waitTime = 30000; // 30 seconds
            setBatchProgress(`Đã xong ${i + 1}/${totalPanels}. Chờ ${waitTime / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
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
    if (!window.confirm(`Bạn có chắc chắn muốn xoá toàn bộ truyện "${storyName}" không? Hành động này không thể hoàn tác.`)) return;
    const newLibrary = { ...library };
    delete newLibrary[storyName];
    await saveLibrary(newLibrary);
    if (activeStory === storyName) setActiveStory(null);
  };
  
  const deleteChapter = async (storyName: string, chapterNumber: string) => {
      if (!window.confirm(`Bạn có chắc chắn muốn xoá chương ${chapterNumber} của truyện "${storyName}" không?`)) return;
      const newLibrary = JSON.parse(JSON.stringify(library));
      if (newLibrary[storyName]?.chapters) {
          delete newLibrary[storyName].chapters[chapterNumber];
          if (newLibrary[storyName].bookmark?.chapter === chapterNumber) delete newLibrary[storyName].bookmark;
          await saveLibrary(newLibrary);
      }
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
        if (retryModalData) setRetryModalData(null);
        else if (renameModalData) setRenameModalData(null);
        else if (isSettingsModalOpen) setIsSettingsModalOpen(false);
        else if (currentView === 'reader') exitReader();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, currentView, exitReader, renameModalData, retryModalData]);

  const allTags = useMemo(() => Array.from(new Set(Object.values(library).flatMap(s => s.tags || []))).sort(), [library]);

  const filteredLibraryKeys = useMemo(() => {
    const keys = Object.keys(library);
    const filtered = activeTagFilter ? keys.filter(key => library[key]?.tags?.includes(activeTagFilter)) : keys;
    return filtered.sort((a, b) => library[b].lastModified - library[a].lastModified);
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
                                <button onClick={(e) => { e.stopPropagation(); deleteStory(story); }} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label={`Xoá truyện ${story}`}><TrashIcon className="w-5 h-5 text-[var(--color-text-muted)] hover:text-red-500" /></button>
                            </div>
                        </div>
                      {activeStory === story && (
                        <div className="p-3 border-t border-[var(--color-border-secondary)] bg-[var(--color-bg-hover)]">
                            {library[story].bookmark && (<button onClick={() => openReader(story, library[story].bookmark!.chapter)} className="w-full flex items-center gap-3 text-left p-2 mb-2 rounded-md bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] hover:bg-opacity-80 transition-all font-semibold"><BookmarkSolidIcon className="w-5 h-5 flex-shrink-0"/><span>Tiếp tục đọc: Chương {library[story].bookmark!.chapter}</span></button>)}
                            <div className="space-y-1">{library[story].chapters && Object.keys(library[story].chapters).sort((a, b) => parseFloat(a) - parseFloat(b)).map(chapter => (<div key={chapter} className="flex justify-between items-center group rounded-md hover:bg-[var(--color-bg-active)]"><button onClick={() => openReader(story, chapter)} className="flex-grow flex items-center gap-2 text-left p-2 text-[var(--color-text-secondary)]">{library[story].bookmark?.chapter === chapter ? <BookmarkSolidIcon className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0"/> : <div className="w-4 h-4 flex-shrink-0" />}<span>Chương {chapter}</span></button><div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); renameChapter(story, chapter); }} className="p-2 rounded-full" aria-label={`Sửa chương ${chapter}`}><EditIcon className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)]" /></button><button onClick={(e) => { e.stopPropagation(); deleteChapter(story, chapter); }} className="p-2 rounded-full" aria-label={`Xoá chương ${chapter}`}><TrashIcon className="w-4 h-4 text-[var(--color-text-muted)] hover:text-red-500" /></button></div></div>))}</div>
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
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onSettingsChange={handleSettingsChange} />
      <SyncStatusIndicator status={syncState} />
    </>
  );
};

export default App;