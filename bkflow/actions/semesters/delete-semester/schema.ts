import { z } from "zod";

export const DeleteSemester = z.object({
  id: z.string(),
});
