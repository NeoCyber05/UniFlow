import { z } from "zod";

import { graphPlanSchema } from "@/lib/boards/graph-plan";

export const SaveGraphPlan = z.object({
  boardId: z.string().min(1),
  plan: graphPlanSchema,
});
