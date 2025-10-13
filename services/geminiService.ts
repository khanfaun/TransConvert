
import { GoogleGenAI } from "@google/genai";

// State variables
let apiKeys: string[] = [];
let currentKeyIndex = 0;
let initializationPromise: Promise<void> | null = null;

/**
 * Initializes the API keys by detecting the environment (Vite/Netlify or AI Studio).
 * This logic runs only once.
 */
const initializeApiKeys = async (): Promise<void> => {
  try {
    // Avoid re-initialization
    if (initializationPromise) return initializationPromise;

    let keysFromServer: string[] | undefined;

    // Environment 1: Vite build (e.g., Netlify)
    // Vite defines `process.env` for us.
    // @ts-ignore - This is a Vite-specific define, not a standard Node.js process.env
    if (typeof process !== 'undefined' && process.env.API_KEYS) {
      // @ts-ignore
      const viteKeys = process.env.API_KEYS as unknown;
      if (Array.isArray(viteKeys)) {
        keysFromServer = viteKeys;
      }
    } 
    // Environment 2: Google AI Studio or similar web-based editor
    // Check for a global object provided by the environment.
    else {
      // @ts-ignore - 'google' is a global in the AI Studio environment
      if (typeof google !== 'undefined' && google.aistudio?.user?.getAPIKey) {
        // @ts-ignore
        const apiKey = await google.aistudio.user.getAPIKey();
        if (apiKey) {
          keysFromServer = [apiKey];
        }
      }
    }

    if (Array.isArray(keysFromServer) && keysFromServer.length > 0) {
      apiKeys = keysFromServer.filter((key): key is string => typeof key === 'string' && key.trim() !== '');
    }

    if (apiKeys.length === 0) {
      throw new Error("Không tìm thấy biến môi trường API_KEY hợp lệ nào. Vui lòng cấu hình VITE_API_KEY_1, VITE_API_KEY_2,... trong môi trường của bạn (Netlify hoặc file .env), hoặc đảm bảo API Key được cấp trong môi trường ảo.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Lỗi khởi tạo API: ${message}`, error);
    // Propagate the error to be displayed in the UI.
    throw new Error(`Lỗi khởi tạo API: ${message}`);
  }
};

/**
 * Ensures that the initialization logic is only executed once.
 * @returns {Promise<void>} A promise that resolves when initialization is complete.
 */
const ensureInitialized = (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = initializeApiKeys();
  }
  return initializationPromise;
};


/**
 * Gửi văn bản tiếng Việt đã được dịch thô đến Gemini để biên dịch lại cho mượt mà hơn.
 * @param rawText Văn bản gốc cần xử lý.
 * @returns Văn bản đã được tối ưu hóa.
 */
export const refineVietnameseText = async (rawText: string): Promise<string> => {
  try {
    await ensureInitialized();
  } catch (error) {
    // If initialization fails, re-throw the descriptive error.
    throw error;
  }

  if (apiKeys.length === 0) {
    // This case should be caught by initialization, but it's a safeguard.
    throw new Error("Không có API key nào được cấu hình để thực hiện yêu cầu.");
  }

  // Loop through available keys to find one that works (key rotation and retry).
  const startingKeyIndex = currentKeyIndex;
  for (let i = 0; i < apiKeys.length; i++) {
    const keyToTryIndex = (startingKeyIndex + i) % apiKeys.length;
    const apiKey = apiKeys[keyToTryIndex];
    
    try {
      const ai = new GoogleGenAI({ apiKey });
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

      // Success! Update the currentKeyIndex for the next call to distribute load.
      currentKeyIndex = (keyToTryIndex + 1) % apiKeys.length;
      return refinedText.trim();

    } catch (error) {
      console.error(`Lỗi khi sử dụng API key #${keyToTryIndex + 1}. Đang thử key tiếp theo...`, error);
      if (i === apiKeys.length - 1) { // If this was the last key to try
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("Tất cả các API key cung cấp đều không hợp lệ hoặc đã hết hạn.");
        }
        throw new Error("Không thể kết nối đến dịch vụ biên dịch sau khi đã thử với tất cả các API key.");
      }
    }
  }

  // This part of the code should be unreachable if there's at least one API key.
  throw new Error("Không thể hoàn thành yêu cầu biên dịch.");
};
