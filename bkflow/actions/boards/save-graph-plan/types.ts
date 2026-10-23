import { z } from "zod";

import type { GraphPlan } from "@/lib/boards/graph-plan";
import { ActionState } from "@/lib/create-safe-action";

import { SaveGraphPlan } from "./schema";

export type InputType = z.infer<typeof SaveGraphPlan>;
export type ReturnType = ActionState<InputType, GraphPlan>;
