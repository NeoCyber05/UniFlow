import { z } from "zod";

export const SetCurrentSemester = z.object({
  id: z.string(),
});
