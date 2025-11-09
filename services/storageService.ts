import { DEV_MODE_ENABLED } from './devConfig';
import { DEMO_LIBRARY } from './demoData';
import type { Library, AppSettings } from '../types';


const SETTINGS_KEY = 'ai_story_translator_settings';


/**
 * Tải cài đặt từ localStorage.
 * @returns {AppSettings} Đối tượng cài đặt hoặc giá trị mặc định.
 */
export const loadSettings = (): AppSettings => {
    const defaultSettings: AppSettings = {
        theme: 'dark',
        font: 'sans',
        fontSize: 18
    };

    try {
        const serializedSettings = localStorage.getItem(SETTINGS_KEY);
        if (serializedSettings) {
            const settings = JSON.parse(serializedSettings);
            
            // Migration for old string-based fontSize
            if (typeof settings.fontSize !== 'number') {
                switch (settings.fontSize) {
                    case 'sm':
                        settings.fontSize = 16;
                        break;
                    case 'lg':
                        settings.fontSize = 20;
                        break;
                    case 'base':
                    default:
                        settings.fontSize = 18;
                        break;
                }
            }
            return { ...defaultSettings, ...settings };
        }
    } catch (error) {
        console.error("Lỗi khi tải cài đặt từ localStorage:", error);
    }
    
    return defaultSettings;
};

/**
 * Lưu cài đặt vào localStorage.
 * @param {AppSettings} settings Đối tượng cài đặt cần lưu.
 */
export const saveSettings = (settings: AppSettings): void => {
    try {
        const serializedSettings = JSON.stringify(settings);
        localStorage.setItem(SETTINGS_KEY, serializedSettings);
    // Fix: Added curly braces to the catch block for correct syntax.
    } catch (error) {
        console.error("Lỗi khi lưu cài đặt vào localStorage:", error);
    }
};
