import { z } from "zod";

import { ReminderValue } from "@/actions/cards/create-smart-capture-card/schema";
import { DateOnly, OffsetDateTime } from "@/lib/cards/task-schedule";
import { TaskRepeatSchema } from "@/lib/cards/task-repeat";

export const QuickAddCard = z.object({
  /** UUID ổn định cho một lần gửi → Card.id; retry cùng id không tạo bản thứ hai. Bỏ trống ở caller cũ. */
  creationId: z.optional(z.string().uuid()),
  title: z.string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z.string()
        .min(1, { message: "Vui lòng nhập tiêu đề." })
        .max(200, { message: "Tiêu đề tối đa 200 ký tự." }),
    ),
  /** Bỏ trống → bảng học kỳ hiện tại của workspace cá nhân */
  boardId: z.optional(z.string().min(1)),
  /** Bỏ trống → cột đầu tiên chưa lưu trữ */
  listId: z.optional(z.string().min(1)),
  courseId: z.optional(z.union([z.string().min(1), z.null()])),
  assigneeUserIds: z.optional(z.array(z.string().min(1)).max(10)),
  /** Mô tả (trích đoạn + nguồn); kiểm chi tiết ở creator chung. */
  description: z.optional(z.string().max(3_000, { message: "Mô tả tối đa 3000 ký tự." })),
  dueDate: z.optional(z.union([z.date(), OffsetDateTime, z.null()])),
  deadlineOn: z.optional(z.union([DateOnly, z.null()])),
  scheduledOn: z.optional(z.union([DateOnly, z.null()])),
  scheduledStartAt: z.optional(z.union([OffsetDateTime, z.null()])),
  scheduledEndAt: z.optional(z.union([OffsetDateTime, z.null()])),
  reminder: ReminderValue,
  repeat: z.optional(z.union([TaskRepeatSchema, z.null()])),
  checklistItems: z.optional(z.array(z.string().max(120)).max(20)),
  isImportant: z.optional(z.boolean()),
  myDay: z.optional(z.boolean()),
});
