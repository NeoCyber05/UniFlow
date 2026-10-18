import { z } from "zod";

export const SetCardCourse = z.object({
  id: z.string(),
  boardId: z.string(),
  courseId: z.string().nullable(),
});
