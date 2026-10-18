import { z } from "zod";

import { TaskDatesPatchShape } from "@/lib/cards/task-schedule";

export const CreateCard = z.object({
  title: z.string("Vui lòng nhập tiêu đề").trim().min(1, {
    message: "Tiêu đề quá ngắn (tối thiểu 1 ký tự)",
  }),
  boardId: z.string(),
  listId: z.string(),
  startDate: z.optional(z.union([z.date(), z.null()])),
  dueDate: z.optional(z.union([z.date(), z.null()])),
  ...TaskDatesPatchShape,
  courseId: z.optional(z.union([z.string(), z.null()])),
});
