import { z } from "zod";

export const ToggleCardImportant = z.object({
  cardId: z.string().min(1),
  value: z.boolean(),
});
