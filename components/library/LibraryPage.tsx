import React, { useMemo, useState } from 'react';
import type { Library, StoryData } from '../../types';
import { SettingsIcon, PlusIcon, EditIcon, TrashIcon, TagIcon, PlayCircleIcon } from '../Icons';

export const LibraryPage: React.FC<{
    library: Library;
    onViewChapters: (storyName: string) => void;
    onAddNewChapter: (storyName: string) => void;
    onOpenReader: (story: string, chapter: string) => void;
    onOpenAddStoryModal: () => void;
    onRenameStory: (storyName: string) => void;
    onDeleteStory: (storyName: string) => void;
    onOpenSettings: () => void;
}> = ({ library, onViewChapters, onAddNewChapter, onOpenReader, onOpenAddStoryModal, onRenameStory, onDeleteStory, onOpenSettings }) => {
    
    const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

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
            ? keys.filter(key => (library[key] as StoryData)?.tags?.includes(activeTagFilter))
            : keys;
        return filtered.sort((a, b) => (library[b] as StoryData).lastModified - (library[a] as StoryData).lastModified);
    }, [library, activeTagFilter]);

    return (
        <main className="min-h-screen flex flex-col p-4 sm:p-6 animate-fade-in">
            <header className="flex items-center justify-between w-full max-w-4xl mx-auto mb-6">
                <button onClick={onOpenSettings} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors mr-4" aria-label="Cài đặt">
                    <SettingsIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
                </button>
                <div className="text-center flex-grow">
                    <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">Thư Viện Truyện</h1>
                    <p className="text-[var(--color-text-muted)] mt-2 text-base sm:text-lg">
                        Quản lý các bản dịch của bạn.
                    </p>
                </div>
                <button onClick={onOpenAddStoryModal} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] active:bg-[var(--color-bg-tertiary)] transition-colors ml-4" aria-label="Thêm truyện mới">
                    <PlusIcon className="w-7 h-7 text-[var(--color-text-secondary)]" />
                </button>
            </header>

            <div className="w-full max-w-4xl mx-auto mt-4">
                <div className="space-y-4">
                    {allTags.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--color-text-secondary)]"><TagIcon className="w-4 h-4" /><span>Lọc theo thẻ:</span></div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setActiveTagFilter(null)} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTagFilter === null ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}>Tất cả</button>
                                {allTags.map(tag => (<button key={tag} onClick={() => setActiveTagFilter(tag)} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTagFilter === tag ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-accent)] font-semibold' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]'}`}>{tag}</button>))}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        {filteredLibraryKeys.map(story => {
                            const storyData = library[story];
                            return (
                                <div key={story} className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-lg shadow-[var(--shadow-color)] p-4 sm:p-5 flex flex-col">
                                    <div className="flex-grow cursor-pointer" onClick={() => onViewChapters(story)}>
                                        <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate" title={story}>{story}</h3>
                                        <div className="flex flex-wrap gap-1.5 mt-2">{storyData.tags?.map(tag => (<span key={tag} className="text-xs bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] px-2 py-0.5 rounded-full">{tag}</span>))}</div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-[var(--color-border-secondary)] flex items-center gap-1">
                                        {storyData.bookmark ? (
                                            <button onClick={(e) => { e.stopPropagation(); onOpenReader(story, storyData.bookmark!.chapter); }} className="mr-auto inline-flex items-center justify-center bg-transparent text-[var(--color-accent-primary)] font-semibold py-2 px-3 rounded-lg hover:bg-[var(--color-accent-subtle-bg)] transition-colors text-sm" aria-label={`Tiếp tục đọc chương ${storyData.bookmark.chapter}`}>
                                                <PlayCircleIcon className="w-5 h-5 mr-2" />
                                                <span>Tiếp tục: C.{storyData.bookmark.chapter}</span>
                                            </button>
                                        ) : (
                                            <div className="mr-auto"></div>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); onAddNewChapter(story); }} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] transition-colors" aria-label={`Thêm chương cho ${story}`}><PlusIcon className="w-5 h-5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)]" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onRenameStory(story); }} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] transition-colors" aria-label={`Sửa tên truyện ${story}`}><EditIcon className="w-5 h-5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-primary)]" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteStory(story); }} className="p-2 rounded-full hover:bg-[var(--color-bg-active)] transition-colors" aria-label={`Xoá truyện ${story}`}><TrashIcon className="w-5 h-5 text-[var(--color-text-muted)] hover:text-red-500" /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {filteredLibraryKeys.length === 0 && (<div className="text-center py-10">
                        <p className="text-[var(--color-text-muted)]">{activeTagFilter ? "Không tìm thấy truyện nào với thẻ đã chọn." : "Thư viện của bạn chưa có truyện nào."}</p>
                        <button onClick={onOpenAddStoryModal} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]">
                            <PlusIcon className="w-5 h-5" />
                            Thêm truyện đầu tiên
                        </button>
                    </div>)}
                </div>
            </div>
            <footer className="text-center text-sm text-[var(--color-text-muted)] py-6 mt-auto"><p>Powered by Gemini API</p></footer>
        </main>
    );
};
