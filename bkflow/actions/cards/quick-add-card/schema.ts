import { z } from "zod";

export const QuickAddCard = z.object({
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
  isImportant: z.optional(z.boolean()),
  myDay: z.optional(z.boolean()),
});
