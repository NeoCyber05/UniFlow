import "server-only";

import { generateText } from "ai";

import { logger } from "@/lib/logger";

import { ASSISTANT_MODEL_ID, getAssistantApiKey, getAssistantModel } from "./assistant/config";
import { AI_MODEL, AI_REQUEST_TIMEOUT_MS } from "./config";

type GenerateAiTextInput = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
  error?: {
    message?: string;
  };
};

const getOpenAiApiKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Chưa cấu hình AI. Vui lòng thêm OPENAI_API_KEY hoặc GEMINI_API_KEY.");
  }

  return apiKey;
};

type AiImage = { data: string; mediaType: string };

/** Gemini (same model as the assistant), used when no OpenAI key is configured. */
const generateGeminiText = async ({
  system,
  user,
  temperature,
  maxTokens,
  image,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
}: Required<GenerateAiTextInput> & { image?: AiImage; timeoutMs?: number }) => {
  try {
    const { text } = await generateText({
      model: getAssistantModel(),
      system,
      ...(image
        ? { messages: [{ role: "user" as const, content: [{ type: "file" as const, data: image.data, mediaType: image.mediaType }, { type: "text" as const, text: user }] }] }
        : { prompt: user }),
      temperature,
      maxOutputTokens: maxTokens,
      // Thinking tokens count against maxOutputTokens; these calls are short structured answers.
      // Gemini 2.x tắt bằng budget 0; 3.8 flash không nhận budget 0 hay "minimal" → "low"
      providerOptions: {
        google: { thinkingConfig: /^gemini-2\./.test(ASSISTANT_MODEL_ID) ? { thinkingBudget: 0 } : { thinkingLevel: "low" as const } },
      },
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    const content = text.trim();
    if (!content) throw new Error("AI chưa tạo được nội dung hợp lệ. Vui lòng thử lại.");
    return content;
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("AI phản hồi quá lâu. Vui lòng thử lại.");
    }
    if (error instanceof Error && error.message.startsWith("AI chưa")) throw error;
    logger.error("[GEMINI_GENERATE_TEXT_ERROR]", error, {
      action: "gemini-generate-text",
      aiFeature: "shared-generate-text",
      aiModel: ASSISTANT_MODEL_ID,
    });
    throw new Error("AI chưa phản hồi thành công. Vui lòng thử lại.");
  }
};

/** Đọc ảnh (OCR + hiểu nội dung). Chỉ Gemini; ảnh là base64 không có tiền tố data:. */
export const generateAiTextFromImage = async ({
  system,
  user,
  image,
  maxTokens = 4_000,
}: GenerateAiTextInput & { image: AiImage }) => {
  if (!getAssistantApiKey()) {
    throw new Error("Chưa cấu hình AI đọc ảnh. Vui lòng thêm GEMINI_API_KEY.");
  }
  // Ảnh lớn đọc lâu hơn câu chữ
  return generateGeminiText({ system, user, temperature: 0.1, maxTokens, image, timeoutMs: Math.max(AI_REQUEST_TIMEOUT_MS, 60_000) });
};

export const generateAiText = async ({
  system,
  user,
  temperature = 0.3,
  maxTokens = 700,
}: GenerateAiTextInput) => {
  if (!process.env.OPENAI_API_KEY && getAssistantApiKey()) {
    return generateGeminiText({ system, user, temperature, maxTokens });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "developer",
            content: system,
          },
          {
            role: "user",
            content: user,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

    if (!response.ok) {
      logger.error(
        "[OPENAI_CHAT_COMPLETION_ERROR]",
        new Error(payload?.error?.message ?? `OpenAI returned ${response.status}`),
        {
          action: "openai-chat-completion",
          aiFeature: "shared-generate-text",
          aiModel: AI_MODEL,
          status: response.status,
        },
      );
      throw new Error("AI chưa phản hồi thành công. Vui lòng thử lại.");
    }

    const content = payload?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("AI chưa tạo được nội dung hợp lệ. Vui lòng thử lại.");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("[OPENAI_CHAT_COMPLETION_TIMEOUT]", {
        action: "openai-chat-completion",
        aiFeature: "shared-generate-text",
        aiModel: AI_MODEL,
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
      });

      throw new Error("AI phản hồi quá lâu. Vui lòng thử lại.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Có lỗi xảy ra khi gọi AI. Vui lòng thử lại.");
  } finally {
    clearTimeout(timeout);
  }
};
