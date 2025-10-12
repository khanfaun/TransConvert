// Định nghĩa kiểu dữ liệu cho thư viện
interface ChapterData {
    [chapter: string]: string;
}
interface StoryData {
    chapters: ChapterData;
    lastModified: number;
    tags?: string[];
}
interface Library {
    [storyName: string]: StoryData;
}

// Định nghĩa kiểu dữ liệu cho cài đặt
export interface AppSettings {
    theme: 'light' | 'dark' | 'night';
    font: 'sans' | 'serif' | 'mono';
    fontSize: 'sm' | 'base' | 'lg';
}

const LIBRARY_KEY = 'ai_story_translator_library';
const LAST_STORY_NAME_KEY = 'ai_story_translator_last_story';
const SETTINGS_KEY = 'ai_story_translator_settings';

/**
 * Tải thư viện từ localStorage.
 * @returns {Library} Đối tượng thư viện hoặc đối tượng rỗng nếu không có.
 */
export const loadLibrary = (): Library => {
    try {
        const serializedLibrary = localStorage.getItem(LIBRARY_KEY);
        if (serializedLibrary === null) {
            return {};
        }
        // Ensure old data has a tags property
        const library = JSON.parse(serializedLibrary);
        for (const story in library) {
            if (!library[story].tags) {
                library[story].tags = [];
            }
        }
        return library;
    } catch (error) {
        console.error("Lỗi khi tải thư viện từ localStorage:", error);
        return {};
    }
};

/**
 * Lưu thư viện vào localStorage.
 * @param {Library} library Đối tượng thư viện cần lưu.
 */
export const saveLibrary = (library: Library): void => {
    try {
        const serializedLibrary = JSON.stringify(library);
        localStorage.setItem(LIBRARY_KEY, serializedLibrary);
    } catch (error) {
        console.error("Lỗi khi lưu thư viện vào localStorage:", error);
    }
};

/**
 * Lưu tên truyện được sử dụng gần nhất.
 * @param {string} name Tên truyện.
 */
export const saveLastStoryName = (name: string): void => {
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
    try {
        return localStorage.getItem(LAST_STORY_NAME_KEY) || '';
    } catch (error) {
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
