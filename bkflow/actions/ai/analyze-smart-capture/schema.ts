import { z } from "zod";

import { CaptureSourceSchema, isValidTimeZone } from "@/lib/capture/source";

export const SMART_CAPTURE_RAW_TEXT_MAX_LENGTH = 4_000;

export const AnalyzeSmartCapture = z.object({
  /** "board" (mặc định): Smart Capture nhiều thẻ. "quick": một task cho composer nhập nhanh. */
  mode: z.optional(z.enum(["board", "quick"])),
  /** Bắt buộc ở board mode; quick mode bỏ trống → bảng học kỳ hiện tại. */
  boardId: z.optional(z.string().min(1)),
  rawText: z.string()
    .transform((value) => value.trim())
    .pipe(
      z.string()
        .min(1, { message: "Vui lòng dán nội dung cần phân tích." })
        .max(SMART_CAPTURE_RAW_TEXT_MAX_LENGTH, {
          message: "Nội dung quá dài. Vui lòng rút gọn tối đa 4000 ký tự.",
        }),
    ),
  timezoneOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60),
  nowIso: z.string().datetime(),
  timezoneLabel: z.string().optional(),
  localNowIso: z.string().optional(),
  // Quick mode: identity of the draft revision this answer belongs to.
  draftId: z.optional(z.string().min(1).max(64)),
  textRevision: z.optional(z.number().int().min(0)),
  timeZone: z.optional(z.string().refine(isValidTimeZone, { message: "Múi giờ không hợp lệ." })),
  source: z.optional(CaptureSourceSchema),
}).superRefine((value, ctx) => {
  if ((value.mode ?? "board") === "board" && !value.boardId) {
    ctx.addIssue({ code: "custom", path: ["boardId"], message: "Thiếu bảng." });
  }
  if (value.mode === "quick" && (!value.draftId || value.textRevision === undefined || !value.timeZone)) {
    ctx.addIssue({ code: "custom", path: ["draftId"], message: "Thiếu mã nháp." });
  }
});
