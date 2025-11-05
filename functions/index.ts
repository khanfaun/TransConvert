// ----- GHI CHÚ QUAN TRỌNG -----
// File này chứa mã nguồn cho CLOUD FUNCTIONS FOR FIREBASE.
// Nó không chạy trên trình duyệt của người dùng mà chạy trên máy chủ của Google.
// Để triển khai, bạn cần cài đặt Firebase CLI và deploy function này lên project Firebase của bạn.
// -----------------------------

// Import các thư viện cần thiết cho Cloud Function
// FIX: Switched from require to import for ES Module compatibility.
import * as functions from "firebase-functions";
// FIX: Switched from require to import for ES Module compatibility.
import * as admin from "firebase-admin";
// FIX: Switched from require to import for ES Module compatibility.
import { GoogleGenAI } from "@google/genai";

// Khởi tạo Firebase Admin SDK để có quyền truy cập vào database
admin.initializeApp();

// Lấy API key từ biến môi trường của Cloud Function
// (Bạn cần phải cấu hình biến này khi deploy: `firebase functions:config:set gemini.key="YOUR_API_KEY"`)
// FIX: The original "Cannot redeclare block-scoped variable" error is likely a symptom of module resolution issues. Switching to ES modules with `import` resolves this by creating a proper module scope.
const API_KEY = functions.config().gemini.key;
if (!API_KEY) {
    console.error("Thiếu API Key của Gemini. Vui lòng cấu hình bằng lệnh: firebase functions:config:set gemini.key=\"YOUR_API_KEY\"");
}


/**
 * Hàm gọi đến Gemini API để biên dịch lại văn bản.
 * Logic tương tự như trong `geminiService.ts` nhưng chạy ở môi trường server.
 * @param {string} rawText Văn bản gốc cần xử lý.
 * @returns {Promise<string>} Văn bản đã được biên dịch lại.
 */
async function refineTextOnServer(rawText: string) {
    if (!API_KEY) {
        throw new Error("API Key của Gemini chưa được cấu hình trên server.");
    }
    try {
        // *** FIX: Khởi tạo AI client ngay bên trong hàm để đảm bảo kết nối luôn mới ***
        const ai = new GoogleGenAI({ apiKey: API_KEY });

        const systemInstruction = `Bạn là một biên dịch viên chuyên nghiệp, chuyên xử lý các bản dịch truyện từ tiếng Trung sang tiếng Việt.
Nhiệm vụ của bạn là đọc đoạn văn bản tiếng Việt dưới đây, vốn được dịch một cách máy móc và thô cứng, sau đó biên dịch lại nó thành một đoạn văn thuần Việt, tự nhiên, và mượt mà.

**YÊU CẦU CỐ ĐỊNH:**
1.  **Tuyệt đối giữ nguyên 100% ý nghĩa gốc** của câu chuyện.
2.  **Không được thêm, bớt, hoặc thay đổi** bất kỳ tình tiết, nhân vật hay ý nghĩa nào.
3.  Chỉ tập trung vào việc cải thiện ngôn ngữ, văn phong cho hay hơn.
4.  Chỉ trả về nội dung đã được biên dịch lại, không thêm bất kỳ lời giải thích hay bình luận nào khác.`;

        const contents = `Đây là đoạn văn bản cần bạn xử lý:\n---\n${rawText}\n---`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.3,
                topP: 0.9,
            }
        });

        const refinedText = response.text;
        if (!refinedText || refinedText.trim() === '') {
            throw new Error("API không trả về nội dung nào.");
        }
        return refinedText.trim();
    } catch (error: any) {
        console.error("Lỗi khi gọi Gemini API trên server:", error);
        // Ném lỗi ra ngoài để function có thể xử lý và ghi nhận trạng thái lỗi
        throw new functions.https.HttpsError('internal', 'Lỗi khi gọi API biên dịch.', error);
    }
}


/**
 * Cloud Function được kích hoạt mỗi khi có một task mới được tạo trong `translationQueue`.
 */
// FIX: Switched from `exports.processTranslationQueue` to `export const` for ES Module compatibility.
export const processTranslationQueue = functions.region('asia-southeast1').database.ref('/translationQueue/{taskId}')
    .onCreate(async (snapshot, context) => {
        const taskId = context.params.taskId;
        const taskData = snapshot.val();

        console.log(`Bắt đầu xử lý task: ${taskId}`, taskData);

        // 1. Đánh dấu task là đang được xử lý để tránh xử lý trùng lặp
        await snapshot.ref.update({ status: 'processing', startedAt: admin.database.ServerValue.TIMESTAMP });

        try {
            // 2. Gọi hàm để dịch văn bản
            const refinedText = await refineTextOnServer(taskData.rawText);

            // 3. Chuẩn bị dữ liệu để cập nhật vào thư viện chính
            const libraryRef = admin.database().ref(`/library/${taskData.storyName}`);
            
            // Lấy dữ liệu truyện hiện tại để đảm bảo không ghi đè tags
            const storySnapshot = await libraryRef.get();
            const existingStoryData = storySnapshot.val() || { chapters: {}, tags: [] };

            const updates: { [key: string]: any } = {};
            updates[`chapters/${taskData.chapterNumber}`] = refinedText;
            updates['lastModified'] = admin.database.ServerValue.TIMESTAMP;
            
            // Hợp nhất tags cũ và mới, loại bỏ trùng lặp
            const newTags = new Set([...(existingStoryData.tags || []), ...(taskData.tags || [])]);
            updates['tags'] = Array.from(newTags);


            // 4. Cập nhật thư viện
            await libraryRef.update(updates);
            console.log(`Đã cập nhật thành công chương ${taskData.chapterNumber} cho truyện "${taskData.storyName}".`);

            // 5. Xóa task đã hoàn thành khỏi hàng đợi
            await snapshot.ref.remove();
            console.log(`Đã hoàn thành và xóa task: ${taskId}`);

        } catch (error: any) {
            console.error(`Xử lý task ${taskId} thất bại:`, error);
            // 6. Ghi nhận lỗi vào task để có thể kiểm tra lại
            await snapshot.ref.update({
                status: 'error',
                errorMessage: error.message || 'Lỗi không xác định.',
                finishedAt: admin.database.ServerValue.TIMESTAMP
            });
        }
    });