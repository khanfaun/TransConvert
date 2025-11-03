

import { GoogleGenAI } from "@google/genai";
import { DEV_MODE_ENABLED } from './devConfig';

// State variables
let apiKeys: string[] = [];
let currentKeyIndex = 0;
let initializationPromise: Promise<void> | null = null;

/**
 * Initializes the API keys by detecting the environment (Vite/Netlify or AI Studio).
 * This logic runs only once.
 */
const initializeApiKeys = async (): Promise<void> => {
  // If dev mode is on, we don't need to initialize any keys.
  if (DEV_MODE_ENABLED) {
    console.warn("DEV MODE: API key initialization is skipped.");
    return;
  }
  
  try {
    let keysFromServer: string[] | undefined;

    // Environment 1: Vite build (e.g., Netlify)
    // Vite's 'define' feature replaces __VITE_API_KEYS__ with an actual array literal
    // in the build output, not a string. So, we must check if it's an array.
    // @ts-ignore - __VITE_API_KEYS__ is a custom global defined at build time.
    if (typeof __VITE_API_KEYS__ !== 'undefined' && Array.isArray(__VITE_API_KEYS__)) {
        // @ts-ignore
        keysFromServer = __VITE_API_KEYS__;
    } 
    // Environment 2: Google AI Studio or similar web-based editor
    // If the Vite variable isn't there, check for the AI Studio environment.
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
 * Gửi văn bản tiếng Việt đã được dịch thô đến Gemini để biên dịch lại cho mượt mà hơn, hỗ trợ streaming.
 * @param rawText Văn bản gốc cần xử lý.
 * @param onChunk Callback được gọi với mỗi phần văn bản được dịch.
 * @param signal AbortSignal để hủy yêu cầu.
 * @returns Toàn bộ văn bản đã được tối ưu hóa sau khi stream kết thúc.
 */
export const refineVietnameseText = async (rawText: string, onChunk: (chunk: string) => void, signal: AbortSignal): Promise<string> => {
  if (DEV_MODE_ENABLED) {
    console.warn("DEV MODE: `refineVietnameseText` is returning mock data.");
    const mockContent = `[CHẾ ĐỘ DEV ĐÃ BẬT]\nNội dung sau đây là giả lập, không được dịch bởi AI.\n\n--- BẮT ĐẦU NỘI DUNG GỐC ---\n${rawText}\n--- KẾT THÚC NỘI DUNG GỐC ---`;
    const chunks = mockContent.split(' ');
    let fullText = '';
    for (const chunk of chunks) {
        if (signal.aborted) throw new Error('Yêu cầu đã bị hủy.');
        await new Promise(resolve => setTimeout(resolve, 50)); // Giả lập độ trễ stream
        const textChunk = chunk + ' ';
        onChunk(textChunk);
        fullText += textChunk;
    }
    return fullText.trim();
  }

  await ensureInitialized();

  if (apiKeys.length === 0) {
    throw new Error("Không có API key nào được cấu hình để thực hiện yêu cầu.");
  }

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
    
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
          topP: 0.9,
        }
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        if (signal.aborted) {
           console.log("Stream bị hủy bỏ bởi người dùng.");
           throw new Error('Yêu cầu đã bị hủy.');
        }
        const chunkText = chunk.text;
        if(chunkText){
            onChunk(chunkText);
            fullText += chunkText;
        }
      }

      currentKeyIndex = (keyToTryIndex + 1) % apiKeys.length;
      return fullText.trim();

    } catch (error) {
      console.error(`Lỗi khi sử dụng API key #${keyToTryIndex + 1}. Đang thử key tiếp theo...`, error);
      if (i === apiKeys.length - 1) {
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("Tất cả các API key cung cấp đều không hợp lệ hoặc đã hết hạn.");
        }
        if (error instanceof Error && error.message.includes('Yêu cầu đã bị hủy')) {
            throw error; // Propagate cancellation error
        }
        throw new Error("Không thể kết nối đến dịch vụ biên dịch sau khi đã thử với tất cả các API key.");
      }
    }
  }

  throw new Error("Không thể hoàn thành yêu cầu biên dịch.");
};
