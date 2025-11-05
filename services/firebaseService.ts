import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, push, update, serverTimestamp, child } from "firebase/database";
import type { Library, TranslationQueue, TranslationQueueTask } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyDh1jnrEZlQy1Y3Z6Hfrs7q23WH_e484cc",
  authDomain: "transconvertai.firebaseapp.com",
  databaseURL: "https://transconvertai-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "transconvertai",
  storageBucket: "transconvertai.firebasestorage.app",
  messagingSenderId: "143931334301",
  appId: "1:143931334301:web:a85ba1a1fc939ba3223e74",
  measurementId: "G-FXWMLBJ0LQ"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const LIBRARY_PATH = 'library';
const QUEUE_PATH = 'translationQueue';

/**
 * Interface cho một nhiệm vụ dịch trong hàng đợi.
 */
export interface TranslationTask {
  storyName: string;
  chapterNumber: string;
  rawText: string;
  tags: string[];
}

/**
 * Thêm một hoặc nhiều chương vào hàng đợi dịch trên Firebase.
 * @param tasks Mảng các nhiệm vụ cần thêm vào hàng đợi.
 */
export const addChaptersToTranslationQueue = async (tasks: TranslationTask[]): Promise<void> => {
    const db = getDatabase();
    const updates: { [key: string]: any } = {};
    tasks.forEach(task => {
        const newKey = push(child(ref(db), QUEUE_PATH)).key;
        if (newKey) {
            updates[`/${QUEUE_PATH}/${newKey}`] = {
                ...task,
                status: 'pending',
                createdAt: serverTimestamp()
            };
        }
    });
    await update(ref(db), updates);
};


/**
 * Lưu toàn bộ đối tượng thư viện vào Firebase Realtime Database.
 * @param library Đối tượng thư viện cần lưu.
 */
export const saveLibraryToFirebase = async (library: Library): Promise<void> => {
    const dbRef = ref(database, LIBRARY_PATH);
    await set(dbRef, library);
};

/**
 * Lắng nghe các thay đổi của thư viện trên Firebase và gọi callback khi có cập nhật.
 * @param callback Hàm sẽ được gọi với dữ liệu thư viện mới.
 * @returns Một hàm để hủy lắng nghe (cleanup function).
 */
export const listenToLibraryChanges = (callback: (library: Library) => void): (() => void) => {
    const dbRef = ref(database, LIBRARY_PATH);

    const unsubscribe = onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val() as Library);
        } else {
            console.log("Không có dữ liệu trên Firebase. Trả về thư viện rỗng.");
            callback({});
        }
    }, (error) => {
        console.error("Lỗi khi lắng nghe dữ liệu từ Firebase:", error);
        callback({});
    });

    return () => off(dbRef, 'value', unsubscribe);
};

/**
 * Lắng nghe các thay đổi của hàng đợi dịch trên Firebase.
 * @param callback Hàm sẽ được gọi với dữ liệu hàng đợi mới.
 * @returns Một hàm để hủy lắng nghe.
 */
export const listenToQueueChanges = (callback: (queue: TranslationQueue | null) => void): (() => void) => {
    const queueRef = ref(database, QUEUE_PATH);

    const listener = onValue(queueRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val() as TranslationQueue);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Lỗi khi lắng nghe hàng đợi dịch:", error);
        callback(null);
    });

    return () => off(queueRef, 'value', listener);
};