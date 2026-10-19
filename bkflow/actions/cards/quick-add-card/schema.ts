import { z } from "zod";

import { CaptureSourceSchema } from "@/lib/capture/source";
import { TaskDatesPatchShape } from "@/lib/cards/task-schedule";

export const QuickAddCard = z.object({
  /** Ổn định cho mỗi lần gửi (thành Card.id) để thử lại không tạo trùng; bỏ trống → server tự sinh. */
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
  dueDate: z.optional(z.union([z.date(), z.null()])),
  ...TaskDatesPatchShape,
  reminder: z.optional(z.union([z.string(), z.null()])),
  checklistItems: z.optional(z.array(z.string()).max(20)),
  /** Đoạn chọn từ trang khác; server tự dựng phần mô tả nguồn. */
  source: z.optional(CaptureSourceSchema),
  isImportant: z.optional(z.boolean()),
  myDay: z.optional(z.boolean()),
});
