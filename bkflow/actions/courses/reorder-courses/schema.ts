import { z } from "zod";

export const ReorderCourses = z.object({
  boardId: z.string(),
  items: z.array(z.object({
    id: z.string(),
    order: z.number().int().min(0),
  })).min(1).max(50),
});
