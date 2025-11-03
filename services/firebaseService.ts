import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child, onValue, off, DatabaseReference } from "firebase/database";
import type { Library } from './storageService';

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

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const LIBRARY_PATH = 'library';

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
        // Trong trường hợp lỗi, có thể gọi callback với object rỗng để tránh crash app
        callback({});
    });

    // Trả về hàm cleanup để có thể hủy lắng nghe khi component unmount
    return () => off(dbRef, 'value', unsubscribe);
};
