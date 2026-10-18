import { z } from "zod";

export const SetPersonalWorkspace = z.object({
  orgId: z.string().min(1),
});
