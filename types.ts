export interface PanelState {
  id: string;
  storyName: string;
  chapterNumber: string;
  inputText: string;
  tags: string; // Comma-separated tags
  isLoading: boolean;
  error: string | null;
}

export interface ChapterData {
  [chapter: string]: string;
}

export interface StoryData {
  chapters: ChapterData;
  lastModified: number;
  tags?: string[];
  bookmark?: {
    chapter: string;
    scrollPosition: number; // 0 to 1, representing percentage
    readToIndex?: number; // Index of the paragraph read up to
  };
}

export interface Library {
  [storyName: string]: StoryData;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';
export type AppView = 'library' | 'chapterList' | 'editor' | 'reader';

export interface RenameModalData {
  type: 'story' | 'chapter';
  oldName: string;
  storyName?: string; // For chapter rename
}

export interface DeleteModalData {
  type: 'story' | 'chapter';
  storyName: string;
  chapterNumber?: string;
}

export interface AppSettings {
    theme: 'light' | 'dark' | 'night';
    font: 'sans' | 'serif' | 'mono';
    fontSize: number;
}