import { z } from "zod";

export const SetCardCompleted = z.object({
  cardId: z.string().min(1),
  value: z.boolean(),
});
