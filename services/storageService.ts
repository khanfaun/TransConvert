import { DEV_MODE_ENABLED } from './devConfig';
import { DEMO_LIBRARY } from './demoData';

// Định nghĩa kiểu dữ liệu cho thư viện
interface ChapterData {
    [chapter: string]: string;
}
export interface StoryData {
    chapters: ChapterData;
    lastModified: number;
    tags?: string[];
    bookmark?: {
        chapter: string;
        scrollPosition: number;
    };
}
export interface Library {
    [storyName: string]: StoryData;
}

// Định nghĩa kiểu dữ liệu cho cài đặt
export interface AppSettings {
    theme: 'light' | 'dark' | 'night';
    font: 'sans' | 'serif' | 'mono';
    fontSize: 'sm' | 'base' | 'lg';
}

const LAST_STORY_NAME_KEY = 'ai_story_translator_last_story';
const SETTINGS_KEY = 'ai_story_translator_settings';


/**
 * Lưu tên truyện được sử dụng gần nhất.
 * @param {string} name Tên truyện.
 */
export const saveLastStoryName = (name: string): void => {
    if (DEV_MODE_ENABLED) {
        return; // Không lưu trong dev mode
    }
    try {
        localStorage.setItem(LAST_STORY_NAME_KEY, name);
    } catch (error) {
        console.error("Lỗi khi lưu tên truyện gần nhất:", error);
    }
};

/**
 * Tải tên truyện được sử dụng gần nhất.
 * @returns {string} Tên truyện hoặc chuỗi rỗng.
 */
export const loadLastStoryName = (): string => {
    if (DEV_MODE_ENABLED) {
        return Object.keys(DEMO_LIBRARY)[0] || ''; // Trả về tên truyện đầu tiên trong demo data
    }
    try {
        return localStorage.getItem(LAST_STORY_NAME_KEY) || '';
    } catch (error) {
        // FIX: Added missing curly braces for the catch block.
        console.error("Lỗi khi tải tên truyện gần nhất:", error);
        return '';
    }
};

/**
 * Tải cài đặt từ localStorage.
 * @returns {AppSettings} Đối tượng cài đặt hoặc giá trị mặc định.
 */
export const loadSettings = (): AppSettings => {
    try {
        const serializedSettings = localStorage.getItem(SETTINGS_KEY);
        if (serializedSettings) {
            return JSON.parse(serializedSettings);
        }
    } catch (error) {
        console.error("Lỗi khi tải cài đặt từ localStorage:", error);
    }
    // Return default settings
    return {
        theme: 'dark',
        font: 'sans',
        fontSize: 'base'
    };
};

/**
 * Lưu cài đặt vào localStorage.
 * @param {AppSettings} settings Đối tượng cài đặt cần lưu.
 */
export const saveSettings = (settings: AppSettings): void => {
    try {
        const serializedSettings = JSON.stringify(settings);
        localStorage.setItem(SETTINGS_KEY, serializedSettings);
    } catch (error) {
        console.error("Lỗi khi lưu cài đặt vào localStorage:", error);
    }
};
