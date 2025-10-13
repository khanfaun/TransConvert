import { GoogleGenAI } from "@google/genai";

// Wrap initialization in a try/catch block to prevent the app from crashing on load
// if an API key is missing. This provides a better user experience by showing
// the error in the UI when a translation is attempted, rather than a blank screen.
let ai: GoogleGenAI | null = null;
let initializationError: string | null = null;

try {
  // FIX: Adhere to guidelines by using process.env.API_KEY exclusively.
  // This resolves the 'import.meta.env' error and aligns with the requirement
  // to use a single, pre-configured API key.
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (e) {
  console.error("Lỗi khi khởi tạo GoogleGenAI client:", e);
  initializationError = e instanceof Error ? e.message : "Lỗi không xác định trong quá trình khởi tạo AI service.";
}


/**
 * Gửi văn bản tiếng Việt đã được dịch thô đến Gemini để biên dịch lại cho mượt mà hơn.
 * @param rawText Văn bản gốc cần xử lý.
 * @returns Văn bản đã được tối ưu hóa.
 */
export const refineVietnameseText = async (rawText: string): Promise<string> => {
  // If the client failed to initialize, throw the saved error message.
  if (initializationError) {
    throw new Error(initializationError);
  }
  // This should not happen if initializationError is null, but it's a safe fallback.
  if (!ai) {
    throw new Error("AI client không được khởi tạo thành công.");
  }
  
  try {
    const systemInstruction = `Bạn là một biên dịch viên chuyên nghiệp, chuyên xử lý các bản dịch truyện từ tiếng Trung sang tiếng Việt.
Nhiệm vụ của bạn là đọc đoạn văn bản tiếng Việt dưới đây, vốn được dịch một cách máy móc và thô cứng, sau đó biên dịch lại nó thành một đoạn văn thuần Việt, tự nhiên, và mượt mà.

**YÊU CẦU CỐ ĐỊNH:**
1.  **Tuyệt đối giữ nguyên 100% ý nghĩa gốc** của câu chuyện.
2.  **Không được thêm, bớt, hoặc thay đổi** bất kỳ tình tiết, nhân vật hay ý nghĩa nào.
3.  Chỉ tập trung vào việc cải thiện ngôn ngữ, văn phong cho hay hơn.
4.  Chỉ trả về nội dung đã được biên dịch lại, không thêm bất kỳ lời giải thích hay bình luận nào khác.`;
    
    const contents = `Đây là đoạn văn bản cần bạn xử lý:
---
${rawText}
---`;
    
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
    if (!refinedText) {
        throw new Error("API không trả về nội dung nào.");
    }
    return refinedText.trim();
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
         throw new Error("API key của bạn không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.");
    }
    throw new Error("Không thể kết nối đến dịch vụ biên dịch. Vui lòng kiểm tra API key và kết nối mạng.");
  }
};
