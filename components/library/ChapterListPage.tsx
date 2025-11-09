import React from 'react';
import type { StoryData } from '../../types';
import { ArrowLeftIcon, BookmarkSolidIcon, EditIcon, TrashIcon } from '../Icons';

export const ChapterListPage: React.FC<{
    storyName: string;
    storyData: StoryData;
    onOpenReader: (story: string, chapter: string) => void;
    onBack: () => void;
    onRenameChapter: (chapterNumber: string) => void;
    onDeleteChapter: (chapterNumber: string) => void;
}> = ({ storyName, storyData, onOpenReader, onBack, onRenameChapter, onDeleteChapter }) => {
    
    const sortedChapters = storyData.chapters ? Object.keys(storyData.chapters).sort((a, b) => parseFloat(b) - parseFloat(a)) : [];

    return (
        <main className="min-h-screen flex flex-col p-4 sm:p-6 animate-fade-in">
            <header className="flex items-center w-full max-w-5xl mx-auto mb-6">
                <button onClick={onBack} className="flex items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Quay lại thư viện">
                    <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
                    <span className="hidden sm:inline text-md font-semibold text-[var(--color-text-secondary)]">Thư viện</span>
                </button>
                <div className="text-center flex-grow mx-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] truncate" title={storyName}>{storyName}</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">{sortedChapters.length} chương</p>
                </div>
                <div className="w-24 flex-shrink-0"></div>
            </header>

            <div className="w-full max-w-5xl mx-auto flex-grow">
                {sortedChapters.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {sortedChapters.map(chapter => (
                            <div key={chapter} className="group relative">
                                <button 
                                    onClick={() => onOpenReader(storyName, chapter)} 
                                    className="w-full flex items-center justify-between text-left p-3 rounded-lg bg-[var(--color-bg-secondary)] shadow-sm hover:bg-[var(--color-bg-active)] hover:shadow-md transition-all duration-200"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        {storyData.bookmark?.chapter === chapter && (
                                            <BookmarkSolidIcon className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0"/> 
                                        )}
                                        <span className={`font-semibold text-[var(--color-text-primary)] truncate ${storyData.bookmark?.chapter !== chapter && 'ml-5'}`}>
                                            Chương {chapter}
                                        </span>
                                    </div>
                                </button>
                                
                                <div className="absolute top-1/2 right-3 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-[var(--color-bg-active)] rounded-full shadow-sm">
                                    <button onClick={() => onRenameChapter(chapter)} className="p-1.5" aria-label={`Sửa chương ${chapter}`}>
                                        <EditIcon className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)]" />
                                    </button>
                                    <button onClick={() => onDeleteChapter(chapter)} className="p-1.5" aria-label={`Xoá chương ${chapter}`}>
                                        <TrashIcon className="w-4 h-4 text-[var(--color-text-muted)] hover:text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-[var(--color-text-muted)] py-16 bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl shadow-[var(--shadow-color)]">
                        <p className="font-semibold">Truyện này chưa có chương nào.</p>
                        <p className="text-sm mt-2">Bạn có thể quay lại thư viện và thêm chương mới.</p>
                    </div>
                )}
            </div>
            <footer className="text-center text-sm text-[var(--color-text-muted)] py-6 mt-auto">
                 <p>Chọn một chương để bắt đầu đọc.</p>
            </footer>
        </main>
    );
};