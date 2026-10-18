import { z } from "zod";

export const ToggleCardMyDay = z.object({
  cardId: z.string().min(1),
  value: z.boolean(),
});
