import { z } from "zod";

import { DateOnly } from "@/lib/cards/task-schedule";
import { ImageTaskItem, TimetableSession } from "@/lib/capture/image-import";

export const ImportImageItems = z.object({
  boardId: z.string().min(1),
  /** Thứ Hai của tuần 1 (bắt buộc khi có sessions) */
  week1Start: DateOnly.optional(),
  sessions: z.array(TimetableSession).max(60).optional(),
  items: z.array(ImageTaskItem).max(30).optional(),
}).refine((value) => !value.sessions?.length || value.week1Start, {
  message: "Chọn ngày bắt đầu tuần 1.",
  path: ["week1Start"],
});
