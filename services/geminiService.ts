import { GoogleGenAI } from "@google/genai";

// @ts-ignore - process is available in the aistudio sandbox.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Gửi văn bản tiếng Việt đã được dịch thô đến Gemini để biên dịch lại cho mượt mà hơn.
 * @param rawText Văn bản gốc cần xử lý.
 * @returns Văn bản đã được tối ưu hóa.
 */
export const refineVietnameseText = async (rawText: string): Promise<string> => {
  try {
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
    throw new Error("Không thể kết nối đến dịch vụ biên dịch.");
  }
};
