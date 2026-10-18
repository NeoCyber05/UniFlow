import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";
import { SetPersonalWorkspace } from "./schema";

export type InputType = z.infer<typeof SetPersonalWorkspace>;
export type ReturnType = ActionState<InputType, { personalOrgId: string }>;
