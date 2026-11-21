import "server-only";

import { generateText, parseJsonEventStream, streamText } from "ai";
import { z } from "zod";

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

const requestOpenAiText = (
  { system, user, temperature, maxTokens }: Required<GenerateAiTextInput>,
  signal: AbortSignal,
  stream = false,
) => fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${getOpenAiApiKey()}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: AI_MODEL,
    messages: [{ role: "developer", content: system }, { role: "user", content: user }],
    temperature,
    max_tokens: maxTokens,
    ...(stream && { stream }),
  }),
  signal,
});

const geminiProviderOptions = {
  google: { thinkingConfig: /^gemini-2\./.test(ASSISTANT_MODEL_ID) ? { thinkingBudget: 0 } : { thinkingLevel: "low" as const } },
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
      providerOptions: geminiProviderOptions,
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
    const response = await requestOpenAiText({ system, user, temperature, maxTokens }, controller.signal);

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

const OpenAiTextEvent = z.object({
  choices: z.array(z.object({ delta: z.object({ content: z.string().nullish() }).optional() })).optional(),
  error: z.object({ message: z.string() }).optional(),
});

export async function* streamAiText(
  { system, user, temperature = 0.3, maxTokens = 700 }: GenerateAiTextInput,
  abortSignal: AbortSignal,
): AsyncGenerator<string> {
  const signal = AbortSignal.any([abortSignal, AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)]);
  if (!process.env.OPENAI_API_KEY && getAssistantApiKey()) {
    const result = streamText({
      model: getAssistantModel(),
      system,
      prompt: user,
      temperature,
      maxOutputTokens: maxTokens,
      providerOptions: geminiProviderOptions,
      abortSignal: signal,
    });
    yield* result.textStream;
    return;
  }

  const response = await requestOpenAiText({ system, user, temperature, maxTokens }, signal, true);
  if (!response.ok || !response.body) throw new Error(`OpenAI stream HTTP ${response.status}`);
  const reader = parseJsonEventStream({ stream: response.body, schema: OpenAiTextEvent }).getReader();
  try {
    for (let event = await reader.read(); !event.done; event = await reader.read()) {
      if (!event.value.success) throw new Error("Invalid OpenAI stream event");
      if (event.value.value.error) throw new Error("OpenAI returned a stream error");
      const text = event.value.value.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
