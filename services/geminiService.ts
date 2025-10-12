import { GoogleGenAI } from "@google/genai";

// Tự động tìm tất cả các API key từ biến môi trường của Vite.
// Người dùng cần đặt tên các biến là VITE_API_KEY_1, VITE_API_KEY_2, ...
// @ts-ignore - import.meta.env is a Vite feature.
const apiKeys: string[] = Object.keys(import.meta.env)
  .filter(key => key.startsWith('VITE_API_KEY_'))
  .map(key => import.meta.env[key] as string)
  .filter(key => key); // Lọc ra các key rỗng hoặc undefined

if (apiKeys.length === 0) {
  // Ném ra lỗi rõ ràng nếu không tìm thấy key nào
  throw new Error("Không tìm thấy VITE_API_KEY nào trong biến môi trường. Vui lòng đặt ít nhất một key có tên dạng VITE_API_KEY_1 trong phần cài đặt.");
}

let currentKeyIndex = 0;

/**
 * Chọn một API key tiếp theo từ danh sách theo chiến lược xoay vòng (round-robin).
 * @returns {string} Một API key.
 */
const getNextApiKey = (): string => {
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
};


/**
 * Gửi văn bản tiếng Việt đã được dịch thô đến Gemini để biên dịch lại cho mượt mà hơn.
 * @param rawText Văn bản gốc cần xử lý.
 * @returns Văn bản đã được tối ưu hóa.
 */
export const refineVietnameseText = async (rawText: string): Promise<string> => {
  try {
    // Với mỗi yêu cầu, lấy một API key từ danh sách
    const apiKey = getNextApiKey();
    if (!apiKey) {
      throw new Error("Không có API key hợp lệ để sử dụng.");
    }
    
    // Tạo một instance Gemini AI mới với key đã chọn
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Bạn là một biên dịch viên chuyên nghiệp, chuyên xử lý các bản dịch truyện từ tiếng Trung sang tiếng Việt.
Nhiệm vụ của bạn là đọc đoạn văn bản tiếng Việt dưới đây, vốn được dịch một cách máy móc và thô cứng, sau đó biên dịch lại nó thành một đoạn văn thuần Việt, tự nhiên, và mượt mà.

**YÊU CẦU CỐ ĐỊNH:**
1.  **Tuyệt đối giữ nguyên 100% ý nghĩa gốc** của câu chuyện.
2.  **Không được thêm, bớt, hoặc thay đổi** bất kỳ tình tiết, nhân vật hay ý nghĩa nào.
3.  Chỉ tập trung vào việc cải thiện ngôn ngữ, văn phong cho hay hơn.
4.  Chỉ trả về nội dung đã được biên dịch lại, không thêm bất kỳ lời giải thích hay bình luận nào khác.

Đây là đoạn văn bản cần bạn xử lý:
---
${rawText}
---`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
        topP: 0.9,
      }
    });

    const refinedText = response.text;
    if (!refinedText) {
        throw new Error("API không trả về nội dung nào.");
    }
    return refinedText.trim();
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
         throw new Error("Một trong các API key của bạn không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.");
    }
    throw new Error("Không thể kết nối đến dịch vụ biên dịch. Vui lòng kiểm tra API key và kết nối mạng.");
  }
};
