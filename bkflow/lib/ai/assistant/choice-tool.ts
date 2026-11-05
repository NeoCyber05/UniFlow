import { tool } from "ai";
import { z } from "zod";

export const CHOICE_LIMITS = { minOptions: 2, maxOptions: 6 } as const;

export const ChoiceOptionSchema = z.object({
  label: z.string().trim().min(1).max(80).describe("Tên ngắn của lựa chọn, ví dụ tên thẻ."),
  detail: z.string().trim().max(140).optional().describe("Thông tin để phân biệt: mã môn, hạn, cột, bảng."),
  reply: z.string().trim().min(1).max(300).describe("Câu trả lời gửi lại cho trợ lý khi người dùng bấm lựa chọn này; nêu đủ để không mơ hồ (tên + môn/hạn)."),
});

export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;
export type ChoiceOutput = { ok: true; action: "choice"; question: string; options: ChoiceOption[] };

export const isChoiceOutput = (value: unknown): value is ChoiceOutput =>
  (value as { action?: string } | null)?.action === "choice" && Array.isArray((value as { options?: unknown }).options);

/**
 * Hỏi lại người dùng bằng lựa chọn bấm được (trùng tên thẻ, thiếu thông tin). Không ghi dữ liệu;
 * lượt của trợ lý dừng ngay sau công cụ này và câu trả lời đến như một tin nhắn mới của người dùng.
 */
export const askChoiceTool = tool({
  description: "Hỏi lại người dùng bằng 2–6 lựa chọn bấm được khi có nhiều thẻ/trang khớp hoặc cần chọn một phương án. Sau khi gọi, KHÔNG viết thêm gì; chờ người dùng chọn.",
  inputSchema: z.object({
    question: z.string().trim().min(1).max(200),
    options: z.array(ChoiceOptionSchema).min(CHOICE_LIMITS.minOptions).max(CHOICE_LIMITS.maxOptions),
  }),
  execute: async ({ question, options }): Promise<ChoiceOutput> => ({ ok: true, action: "choice", question, options }),
});
