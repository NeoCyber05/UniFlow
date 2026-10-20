import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { ReorderWorkspaces } from "./schema";

export type InputType = z.infer<typeof ReorderWorkspaces>;
export type ReturnType = ActionState<InputType, { count: number }>;
