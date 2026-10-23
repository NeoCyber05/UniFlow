import type { Card } from "@prisma/client";
import { z } from "zod";

import type { ActionState } from "@/lib/create-safe-action";
import { TaskDatesPatchShape } from "@/lib/cards/task-schedule";
import { TaskRepeatSchema } from "@/lib/cards/task-repeat";

export const UpdateCard = z.object({
  boardId: z.string(),
  description: z.optional(z.string()),
  descriptionBaseUpdatedAt: z.optional(z.string().datetime()),
  /** Revision (Card.updatedAt, ISO) client đang thấy; bắt buộc khi sửa metadata. */
  expectedUpdatedAt: z.optional(z.string().datetime()),
  title: z.optional(
    z.string("Vui lòng nhập tiêu đề").trim().min(1, {
      message: "Tiêu đề quá ngắn (tối thiểu 1 ký tự)",
    }),
  ),
  // Legacy: giữ nguyên ngữ nghĩa cũ (metadata), không phải lịch làm mới.
  startDate: z.optional(z.union([z.date(), z.null()])),
  dueDate: z.optional(z.union([z.date(), z.null()])),
  // Mới: hạn chỉ-ngày và lịch làm (xem TaskDatesPatchShape).
  ...TaskDatesPatchShape,
  dueDateTimezoneOffset: z.optional(z.number()),
  isCompleted: z.optional(z.boolean()),
  reminder: z.optional(z.union([z.string(), z.null()])),
  repeat: TaskRepeatSchema.nullable().optional(),
  id: z.string(),
}).superRefine((data, ctx) => {
  if (data.description !== undefined && !data.descriptionBaseUpdatedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["descriptionBaseUpdatedAt"],
      message: "Thiếu mốc cập nhật mô tả.",
    });
  }

  if (hasMetadataUpdate(data) && !data.expectedUpdatedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["expectedUpdatedAt"],
      message: "Thiếu mốc cập nhật của thẻ.",
    });
  }
});

const METADATA_KEYS = [
  "title",
  "startDate",
  "dueDate",
  "deadlineOn",
  "scheduledOn",
  "scheduledStartAt",
  "scheduledEndAt",
  "isCompleted",
  "reminder",
  "repeat",
] as const;

/** Có trường metadata (mọi thứ ngoài mô tả) trong patch hay không. */
export const hasMetadataUpdate = (data: Partial<Record<(typeof METADATA_KEYS)[number], unknown>>) =>
  METADATA_KEYS.some((key) => data[key] !== undefined);

export type UpdateCardInput = z.infer<typeof UpdateCard>;
export type UpdateCardResult = ActionState<UpdateCardInput, Card>;
