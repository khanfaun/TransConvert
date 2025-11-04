import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { SettingsIcon, BookmarkIcon, BookmarkSolidIcon, CopyIcon, CheckIcon, ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, ArrowUpIcon, ArrowDownIcon, PlayCircleIcon, PauseCircleIcon } from '../Icons';
import type { AppSettings, Library } from '../../types';
import { ToastNotification } from '../ui/ToastNotification';

export const ReaderPage: React.FC<{
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
  const [isSpeedSelectorOpen, setIsSpeedSelectorOpen] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const chapterListRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const legacyAutoScrollIntervalRef = useRef<number | null>(null);
  const autoScrollIconIntervalRef = useRef<number | null>(null);
  const speedSelectorRef = useRef<HTMLDivElement>(null);
  
  // Refs for smooth scrolling animation
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const scrollPositionRef = useRef<number>(0);

  const storyData = library[storyName];
  const bookmark = storyData?.bookmark;

  const { chapterText, paragraphs } = useMemo(() => {
    const text = storyData?.chapters?.[chapterNumber] || "Không tìm thấy nội dung chương.";
    const para = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
    return { chapterText: text, paragraphs: para };
  }, [storyData, chapterNumber]);

  const { chapterList, prevChapter, nextChapter } = useMemo(() => {
    if (!storyData || !storyData.chapters) return { chapterList: [], prevChapter: null, nextChapter: null };
    const chapters = Object.keys(storyData.chapters).sort((a, b) => parseFloat(a) - parseFloat(b));
    const currentIndex = chapters.indexOf(chapterNumber);
    const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
    const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
    return { chapterList: chapters, prevChapter: prev, nextChapter: next };
  }, [storyData, chapterNumber]);

  // Toast notification logic for new chapters
  const chapterCount = useMemo(() => (storyData?.chapters ? Object.keys(storyData.chapters).length : 0), [storyData]);
  const prevChapterCountRef = useRef(chapterCount);

  useEffect(() => {
    if (prevChapterCountRef.current > 0 && chapterCount > prevChapterCountRef.current) {
        setToastMessage('Chương mới đã được lưu!');
    }
    prevChapterCountRef.current = chapterCount;
  }, [chapterCount]);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const currentBookmark = library[storyName]?.bookmark;

    if (!currentBookmark || currentBookmark.chapter !== chapterNumber) {
        contentElement.scrollTop = 0;
        const timer = setTimeout(() => {
            onSetBookmark(storyName, chapterNumber, 0);
        }, 100);
        return () => clearTimeout(timer);
    } 
    else if (currentBookmark) {
        const timer = setTimeout(() => {
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                if (scrollHeight > clientHeight) {
                    contentRef.current.scrollTop = currentBookmark.scrollPosition * (scrollHeight - clientHeight);
                } else {
                    contentRef.current.scrollTop = 0;
                }
            }
        }, 50);
        return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyName, chapterNumber]);

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
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (chapterListRef.current && !chapterListRef.current.contains(event.target as Node)) setIsChapterListOpen(false);
        if (speedSelectorRef.current && !speedSelectorRef.current.contains(event.target as Node)) setIsSpeedSelectorOpen(false);
    };
    if (isChapterListOpen || isSpeedSelectorOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isChapterListOpen, isSpeedSelectorOpen]);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft' && prevChapter) onChapterChange(storyName, prevChapter);
        else if (event.key === 'ArrowRight' && nextChapter) onChapterChange(storyName, nextChapter);
        
        const target = event.target as HTMLElement;
        if (['0', '1', '2', '3', '4', '5'].includes(event.key) && target.tagName.toLowerCase() !== 'input' && target.tagName.toLowerCase() !== 'textarea') {
            event.preventDefault();
            const newSpeed = parseInt(event.key, 10);
            setAutoScrollSpeed(prevSpeed => (prevSpeed === newSpeed ? 0 : newSpeed));
        }
    };

    const startScrolling = (direction: 'up' | 'down') => {
        if (legacyAutoScrollIntervalRef.current) return;
        const scrollAmount = direction === 'down' ? 2 : -2;
        legacyAutoScrollIntervalRef.current = window.setInterval(() => {
            contentElement.scrollTop += scrollAmount;
        }, 16);
    };

    const stopScrolling = () => {
        if (legacyAutoScrollIntervalRef.current) {
            window.clearInterval(legacyAutoScrollIntervalRef.current);
            legacyAutoScrollIntervalRef.current = null;
        }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
        if (e.button === 3) { e.preventDefault(); startScrolling('down'); }
        else if (e.button === 4) { e.preventDefault(); startScrolling('up'); }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
        if (e.button === 3 || e.button === 4) { e.preventDefault(); stopScrolling(); }
    };
    
    const handleAuxClick = (e: MouseEvent) => {
        if (e.button === 3 || e.button === 4) e.preventDefault();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('auxclick', handleAuxClick);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('mousedown',handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('auxclick', handleAuxClick);
        stopScrolling();
        if (autoScrollIconIntervalRef.current) window.clearInterval(autoScrollIconIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [storyName, prevChapter, nextChapter, onChapterChange]);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const scrollAnimation = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // New speed scale based on pixels per second for smoother scrolling
      // Speed 1 -> 20px/s, 2 -> 30px/s, ..., 5 -> 60px/s
      const pixelsPerSecond = 5 + autoScrollSpeed * 5;
      const scrollAmount = (pixelsPerSecond * deltaTime) / 1000;
      
      scrollPositionRef.current += scrollAmount;
      contentElement.scrollTop = Math.round(scrollPositionRef.current);

      if (contentElement.scrollTop + contentElement.clientHeight >= contentElement.scrollHeight - 1) {
        setAutoScrollSpeed(0);
      } else {
        animationFrameRef.current = requestAnimationFrame(scrollAnimation);
      }
    };

    if (autoScrollSpeed > 0) {
      lastTimeRef.current = 0; // Reset time for animation start
      scrollPositionRef.current = contentElement.scrollTop; // Start from current position
      animationFrameRef.current = requestAnimationFrame(scrollAnimation);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [autoScrollSpeed, setAutoScrollSpeed]);
  
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;
    const handleWheel = (event: WheelEvent) => {
        if (event.deltaY < 0 && autoScrollSpeed > 0) setAutoScrollSpeed(0);
    };
    contentElement.addEventListener('wheel', handleWheel, { passive: true });
    return () => contentElement.removeEventListener('wheel', handleWheel);
  }, [autoScrollSpeed]);

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
  
  const handleParagraphClick = (index: number) => {
      const currentReadToIndex = bookmark?.readToIndex;
      if (currentReadToIndex != null && index === currentReadToIndex - 1) onSetReadToIndex(storyName, chapterNumber, 0);
      else onSetReadToIndex(storyName, chapterNumber, index + 1);
  };
  
  const readerStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    const fontMap: Record<AppSettings['font'], string> = { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' };
    style.fontFamily = fontMap[settings.font];
    style.fontSize = `${settings.fontSize}px`;
    return style;
  }, [settings.font, settings.fontSize]);
  
  const startIconScrolling = (direction: 'up' | 'down') => {
    if (autoScrollIconIntervalRef.current) window.clearInterval(autoScrollIconIntervalRef.current);
    const contentElement = contentRef.current;
    if (!contentElement) return;
    const scrollAmount = direction === 'down' ? 6 : -6;
    autoScrollIconIntervalRef.current = window.setInterval(() => {
      contentElement.scrollTop += scrollAmount;
    }, 16);
  };

  const stopIconScrolling = () => {
    if (autoScrollIconIntervalRef.current) {
      window.clearInterval(autoScrollIconIntervalRef.current);
      autoScrollIconIntervalRef.current = null;
    }
  };
  
  const handleSpeedSelect = (speed: number) => {
    setAutoScrollSpeed(prev => prev === speed ? 0 : speed);
    setIsSpeedSelectorOpen(false);
  };

  const upButtonProps = isDesktop ? {
      onMouseDown: () => { startIconScrolling('up'); if (autoScrollSpeed > 0) setAutoScrollSpeed(0); },
      onMouseUp: stopIconScrolling,
      onMouseLeave: stopIconScrolling,
      'aria-label': "Nhấn giữ để cuộn lên"
  } : {
      onClick: () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }),
      'aria-label': "Về đầu trang"
  };

  const ChapterNavigation: React.FC = () => (
    <div className="flex items-center justify-center gap-2 sm:gap-4 p-2 text-[var(--color-text-secondary)]">
        <button onClick={() => onChapterChange(storyName, prevChapter!)} disabled={!prevChapter} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold" aria-label="Chương trước">
            <ChevronLeftIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">Trước</span>
        </button>
        <div className="relative" ref={chapterListRef}>
          <button onClick={() => setIsChapterListOpen(prev => !prev)} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-active)] transition-colors text-sm font-semibold" aria-label="Danh sách chương">
              <ListIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">Danh sách</span>
          </button>
          {isChapterListOpen && (
            <div className="absolute bottom-full mb-2 w-72 max-w-[90vw] bg-[var(--color-bg-secondary)] rounded-lg shadow-xl border border-[var(--color-border-primary)] max-h-80 overflow-y-auto z-10 left-1/2 -translate-x-1/2 p-2 space-y-1">
              {chapterList.map(chap => (<button key={chap} onClick={() => handleChapterSelect(chap)} className={`block w-full text-left p-2 rounded-md text-sm transition-colors ${chap === chapterNumber ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] font-semibold' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}>Chương {chap}</button>))}
            </div>
          )}
        </div>
        <button onClick={() => onChapterChange(storyName, nextChapter!)} disabled={!nextChapter} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold" aria-label="Chương sau">
            <span className="hidden sm:inline">Sau</span>
            <ChevronRightIcon className="w-5 h-5"/>
        </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)] z-40 flex flex-col animate-fade-in">
        {toastMessage && (
            <ToastNotification 
                message={toastMessage} 
                onClose={() => setToastMessage(null)}
            />
        )}
        <header className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border-secondary)] flex-shrink-0 w-full max-w-5xl mx-auto">
          <button onClick={onExit} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Quay lại">
            <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            <span className="hidden sm:inline text-md font-semibold text-[var(--color-text-secondary)]">Thư viện</span>
          </button>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] text-center truncate px-2" title={`${storyName} - Chương ${chapterNumber}`}>{`Chương ${chapterNumber}`}</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={handleToggleBookmark} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label={bookmark?.chapter === chapterNumber ? "Bỏ đánh dấu chương" : "Đánh dấu chương này"}>
                {bookmark?.chapter === chapterNumber ? <BookmarkSolidIcon className="w-6 h-6 text-[var(--color-accent-primary)]" /> : <BookmarkIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />}
            </button>
            <button onClick={handleCopyToClipboard} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Sao chép">
                {copySuccess ? <CheckIcon className="w-6 h-6 text-green-600" /> : <CopyIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />}
            </button>
             <button onClick={onOpenSettings} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Cài đặt">
                <SettingsIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </button>
            <div className="relative">
                <button onClick={() => setIsSpeedSelectorOpen(prev => !prev)} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Tự động cuộn">
                    {autoScrollSpeed > 0 ? <PauseCircleIcon className="w-6 h-6 text-[var(--color-accent-primary)]" /> : <PlayCircleIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />}
                </button>
                {isSpeedSelectorOpen && (
                  <div ref={speedSelectorRef} className="absolute right-0 top-full mt-2 w-48 bg-[var(--color-bg-secondary)] rounded-lg shadow-xl border border-[var(--color-border-primary)] z-20 p-2 animate-fade-in-scale">
                      <p className="text-xs text-[var(--color-text-muted)] px-2 pb-1 font-semibold">Tốc độ cuộn</p>
                      {[0, 1, 2, 3, 4, 5].map(speed => (<button key={speed} onClick={() => handleSpeedSelect(speed)} className={`w-full text-left p-2 rounded-md text-sm transition-colors ${speed === autoScrollSpeed ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] font-semibold' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}>{speed === 0 ? 'Dừng' : `Tốc độ ${speed}`}</button>))}
                  </div>
                )}
            </div>
          </div>
        </header>

        <div className="relative overflow-y-auto flex-grow w-full reader-content" ref={contentRef}>
            <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8">
                <div className="text-left leading-relaxed text-[var(--color-text-primary)]" style={readerStyle}>
                  {paragraphs.map((p, index) => {
                      const isRead = bookmark?.chapter === chapterNumber && bookmark?.readToIndex != null && index < bookmark.readToIndex;
                      return (<p key={index} onClick={() => handleParagraphClick(index)} className={`transition-opacity duration-300 cursor-pointer ${isRead ? 'opacity-40' : 'opacity-100'}`} style={{ whiteSpace: 'pre-wrap', marginBottom: '1em' }}>{p}</p>);
                  })}
                </div>
            </div>
            <div className="fixed bottom-6 right-6 z-20 flex flex-col gap-3">
                <button {...upButtonProps} className="w-12 h-12 rounded-full bg-[var(--color-bg-secondary)] shadow-lg flex items-center justify-center hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors">
                    <ArrowUpIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
                </button>
                {isDesktop && (<button onMouseDown={() => startIconScrolling('down')} onMouseUp={stopIconScrolling} onMouseLeave={stopIconScrolling} className="w-12 h-12 rounded-full bg-[var(--color-bg-secondary)] shadow-lg flex items-center justify-center hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Nhấn giữ để cuộn xuống"><ArrowDownIcon className="w-6 h-6 text-[var(--color-text-secondary)]" /></button>)}
            </div>
        </div>

        <footer className="border-t border-[var(--color-border-secondary)] flex-shrink-0 bg-[var(--color-bg-primary)]">
          <ChapterNavigation />
        </footer>
    </div>
  )
}