import { z } from "zod";

import { TaskDatesPatchShape, validateTaskSchedule } from "@/lib/cards/task-schedule";

const DueDateValue = z.union([z.date(), z.string().datetime({ offset: true }), z.null()]);

const SmartCaptureCardDraft = z.object({
  // Stable per submit; becomes Card.id so a retry maps to the same card.
  creationId: z.string().uuid(),
  listId: z.string().min(1),
  courseId: z.optional(z.union([z.string().min(1), z.null()])),
  title: z.string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z.string()
        .min(1, { message: "Vui lòng nhập tiêu đề." })
        .max(200, { message: "Tiêu đề tối đa 200 ký tự." }),
    ),
  description: z.string()
    .transform((value) => value.trim())
    .pipe(
      z.string()
        .max(3_000, { message: "Mô tả tối đa 3000 ký tự." })
        .refine((value) => !value.includes("```"), {
          message: "Mô tả không được chứa mã markdown code fence.",
        }),
  ),
  dueDate: z.optional(DueDateValue),
  // Hạn chỉ-ngày và lịch làm; không ghi vào startDate legacy.
  ...TaskDatesPatchShape,
  /** Offset phút trước hạn như Card.reminder; null = không nhắc. */
  reminder: z.optional(z.union([z.string().regex(/^\d{1,5}$/, { message: "Mốc nhắc nhở không hợp lệ." }), z.null()])),
  myDay: z.optional(z.boolean()),
  assigneeBoardMemberId: z.optional(z.union([z.string().min(1), z.null()])),
  assigneeBoardMemberIds: z.array(z.string().min(1)).max(20).default([]),
  labelIds: z.array(z.string().min(1)).max(20).default([]),
  isImportant: z.boolean().default(false),
  checklistItems: z.array(
    z.string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().max(120)),
  ).max(20).default([]),
}).superRefine((draft, ctx) => {
  if (draft.dueDate && draft.deadlineOn) {
    ctx.addIssue({ code: "custom", message: "Hạn nộp chỉ có ngày hoặc có giờ, không đồng thời." });
  }
  const scheduleError = validateTaskSchedule({
    scheduledOn: draft.scheduledOn ?? null,
    scheduledStartAt: draft.scheduledStartAt ?? null,
    scheduledEndAt: draft.scheduledEndAt ?? null,
  });
  if (scheduleError) ctx.addIssue({ code: "custom", message: scheduleError });
  if (draft.reminder && !draft.dueDate && !draft.deadlineOn) {
    ctx.addIssue({ code: "custom", message: "Cần có hạn nộp để đặt nhắc nhở." });
  }
});

export const CreateSmartCaptureCards = z.object({
  boardId: z.string().min(1),
  drafts: z.array(SmartCaptureCardDraft).min(1).max(5),
}).refine(
  (value) => new Set(value.drafts.map((draft) => draft.creationId)).size === value.drafts.length,
  { message: "Mã tạo thẻ bị trùng trong cùng yêu cầu." },
);
