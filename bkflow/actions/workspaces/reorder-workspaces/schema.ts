import { z } from "zod";

export const ReorderWorkspaces = z.object({
  items: z.array(z.object({
    id: z.string(),
    order: z.number().int().min(0),
  })).min(1).max(50),
});
