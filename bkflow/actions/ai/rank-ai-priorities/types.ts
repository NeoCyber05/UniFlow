import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";
import type { CustomOrderItem } from "@/lib/boards/graph-priority";

import { RankAiPriorities } from "./schema";

export type InputType = z.infer<typeof RankAiPriorities>;
export type ReturnType = ActionState<InputType, { order: CustomOrderItem[]; summary: string }>;
