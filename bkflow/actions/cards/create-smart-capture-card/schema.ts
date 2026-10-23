import { z } from "zod";

import { DateOnly, OffsetDateTime, validateTaskSchedule } from "@/lib/cards/task-schedule";
import { TaskRepeatSchema } from "@/lib/cards/task-repeat";
import { hasUnsafeMarkdownLink } from "@/lib/capture/source";

const DueDateValue = z.union([z.date(), z.string().datetime({ offset: true }), z.null()]);
const NullableDate = z.optional(z.union([DateOnly, z.null()]));
const NullableInstant = z.optional(z.union([OffsetDateTime, z.null()]));
/** Contract nhắc của card: số phút trước hạn; "none"/null = không nhắc. */
export const ReminderValue = z.optional(z.union([z.string().regex(/^\d{1,6}$/), z.literal("none"), z.null()]));

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
        })
        .refine((value) => !hasUnsafeMarkdownLink(value), {
          message: "Mô tả chứa liên kết không an toàn.",
        }),
  ),
  dueDate: z.optional(DueDateValue),
  deadlineOn: NullableDate,
  scheduledOn: NullableDate,
  scheduledStartAt: NullableInstant,
  scheduledEndAt: NullableInstant,
  reminder: ReminderValue,
  repeat: z.optional(z.union([TaskRepeatSchema, z.null()])),
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
    ctx.addIssue({ code: "custom", path: ["deadlineOn"], message: "Hạn nộp chỉ có ngày hoặc có giờ, không đồng thời." });
  }
  const scheduleError = validateTaskSchedule({
    scheduledOn: draft.scheduledOn ?? null,
    scheduledStartAt: draft.scheduledStartAt ?? null,
    scheduledEndAt: draft.scheduledEndAt ?? null,
  });
  if (scheduleError) ctx.addIssue({ code: "custom", path: ["scheduledOn"], message: scheduleError });
  if (draft.reminder && draft.reminder !== "none" && !draft.dueDate && !draft.deadlineOn) {
    ctx.addIssue({ code: "custom", path: ["reminder"], message: "Nhắc hạn cần có hạn nộp." });
  }
});

export const CreateSmartCaptureCards = z.object({
  boardId: z.string().min(1),
  drafts: z.array(SmartCaptureCardDraft).min(1).max(5),
}).refine(
  (value) => new Set(value.drafts.map((draft) => draft.creationId)).size === value.drafts.length,
  { message: "Mã tạo thẻ bị trùng trong cùng yêu cầu." },
);
