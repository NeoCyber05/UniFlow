import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Định danh mô hình AI mặc định được sử dụng cho Trợ lý Agent (UniFlow Assistant).
 * Lấy từ biến môi trường `GEMINI_MODEL`, mặc định là `"gemini-3.8-flash"`.
 */
export const ASSISTANT_MODEL_ID = process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * Các ngưỡng giới hạn kỹ thuật (rate limits & budget constraints) áp dụng cho Agent:
 * - `maxSteps`: Giới hạn số bước lặp (loop steps) tối đa cho ToolLoopAgent trong 1 phiên chat.
 * - `historyMessages`: Số lượng tin nhắn lịch sử gần nhất được tải vào ngữ cảnh hội thoại.
 * - `messageMaxLength`: Độ dài ký tự tối đa của một tin nhắn từ người dùng (tránh tấn công tràn context).
 * - `contextCards`: Số lượng thẻ tối đa được inject vào system prompt snapshot ban đầu.
 * - `toolResultCards`: Số lượng thẻ tối đa trả về từ mỗi lượt thực thi công cụ (tools) tra cứu.
 */
export const ASSISTANT_LIMITS = {
  maxSteps: 12,
  historyMessages: 30,
  messageMaxLength: 2_000,
  contextCards: 120,
  toolResultCards: 25,
};

/**
 * Lấy khóa bí mật (API Key) của Google Gemini từ biến môi trường.
 *
 * @remarks
 * Hàm kiểm tra lần lượt 2 biến môi trường:
 * 1. `GEMINI_API_KEY`
 * 2. `GOOGLE_GENERATIVE_AI_API_KEY`
 *
 * @returns Chuỗi khóa API Key hợp lệ hoặc `null` nếu cả hai biến đều chưa được thiết lập.
 */
export const getAssistantApiKey = (): string | null =>
  process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;

/**
 * Khởi tạo và cấu hình thực thể mô hình ngôn ngữ (Google Generative AI Language Model)
 * phục vụ cho việc thực thi vòng lặp công cụ (ToolLoopAgent).
 *
 * @returns Đối tượng LanguageModel từ `@ai-sdk/google` sẵn sàng để sinh văn bản hoặc stream.
 *
 * @throws {Error} Ném ra lỗi khi chưa thiết lập khóa `GEMINI_API_KEY` hoặc `GOOGLE_GENERATIVE_AI_API_KEY` trong môi trường server.
 */
export const getAssistantModel = () => {
  const apiKey = getAssistantApiKey();

  if (!apiKey) {
    throw new Error("Chưa cấu hình Trợ lý AI. Vui lòng thêm GEMINI_API_KEY.");
  }

  return createGoogleGenerativeAI({ apiKey })(ASSISTANT_MODEL_ID);
};
