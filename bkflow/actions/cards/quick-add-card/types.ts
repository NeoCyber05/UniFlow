import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";
import type { CardWithAssignees } from "@/types";

import { QuickAddCard } from "./schema";

export type InputType = z.infer<typeof QuickAddCard>;
export type ReturnType = ActionState<InputType, CardWithAssignees>;
