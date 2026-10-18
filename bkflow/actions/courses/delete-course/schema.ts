import { z } from "zod";

export const DeleteCourse = z.object({
  id: z.string(),
  boardId: z.string(),
});
