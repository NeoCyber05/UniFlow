import { z } from "zod";
import { Workspace } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { SetCurrentWorkspace } from "./schema";

export type InputType = z.infer<typeof SetCurrentWorkspace>;
export type ReturnType = ActionState<InputType, Workspace>;
