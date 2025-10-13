import { GoogleGenAI } from "@google/genai";

// FIX: Refactored API key handling to exclusively use `process.env.API_KEY`
// as per the guidelines.
// This new version adds more specific error handling for when `process` is not
// defined, which is a common issue when deploying to environments like Netlify
// without proper build-time variable replacement. The error message now guides
// the user to the correct solution.
let ai: GoogleGenAI;
let initializationError: string | null = null;

try {
  // This line is expected to work in the AI Studio environment.
  // For external deployment (e.g., Netlify), the build process must be
  // configured to replace `process.env.API_KEY` with the actual key.
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error("Biến môi trường API_KEY chưa được cấu hình hoặc trống.");
  }
  ai = new GoogleGenAI({ apiKey });
} catch (e) {
  let message = (e instanceof Error) ? e.message : String(e);
  // Provide a more helpful error for the common Netlify deployment issue.
  if (message.includes("process is not defined")) {
    message = "Lỗi cấu hình môi trường. Vui lòng đảm bảo biến môi trường API_KEY được thiết lập chính xác trong cài đặt của Netlify và được 'inject' vào code trong quá trình build.";
  }
  const errorMessage = `Lỗi khởi tạo API: ${message}`;
  console.error(errorMessage, e);
  initializationError = errorMessage;
}


/**
 * Gửi văn bản tiếng Việt đã được dịch thô đến Gemini để biên dịch lại cho mượt mà hơn.
 * @param rawText Văn bản gốc cần xử lý.
 * @returns Văn bản đã được tối ưu hóa.
 */
export const refineVietnameseText = async (rawText: string): Promise<string> => {
  if (initializationError) {
    throw new Error(initializationError);
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
    console.error(`Lỗi khi gọi Gemini API:`, error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
         throw new Error("API key đang sử dụng không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.");
    }
    throw new Error("Không thể kết nối đến dịch vụ biên dịch. Vui lòng kiểm tra API key và kết nối mạng.");
  }
};