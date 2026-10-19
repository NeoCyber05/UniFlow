import { z } from "zod";

import { isValidTimeZone } from "@/lib/capture/source";

export const SMART_CAPTURE_RAW_TEXT_MAX_LENGTH = 4_000;

const RawText = z.string()
  .transform((value) => value.trim())
  .pipe(
    z.string()
      .min(1, { message: "Vui lòng dán nội dung cần phân tích." })
      .max(SMART_CAPTURE_RAW_TEXT_MAX_LENGTH, {
        message: "Nội dung quá dài. Vui lòng rút gọn tối đa 4000 ký tự.",
      }),
  );

/** Smart Capture nhiều thẻ (mặc định). */
export const AnalyzeSmartCaptureBoard = z.object({
  mode: z.optional(z.literal("board")),
  boardId: z.string().min(1),
  rawText: RawText,
  timezoneOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60),
  nowIso: z.string().datetime(),
  timezoneLabel: z.string().optional(),
  localNowIso: z.string().optional(),
});

/** Quick capture: một câu → đúng một nháp, trả kèm draftId/revision của request. */
export const AnalyzeQuickCapture = z.object({
  mode: z.literal("quick"),
  boardId: z.string().min(1),
  rawText: RawText,
  draftId: z.string().min(1).max(64),
  textRevision: z.number().int().min(0),
  timeZone: z.string().refine(isValidTimeZone, { message: "Múi giờ không hợp lệ." }),
  /** Nguồn từ trang ngoài; kiểm bằng normalizeCaptureSource trong handler. */
  source: z.optional(z.unknown()),
});

export const AnalyzeSmartCapture = z.union([AnalyzeQuickCapture, AnalyzeSmartCaptureBoard]);
