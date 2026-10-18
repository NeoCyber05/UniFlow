import { z } from "zod";
import { CardUserState } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { ToggleCardImportant } from "./schema";

export type InputType = z.infer<typeof ToggleCardImportant>;
export type ReturnType = ActionState<InputType, CardUserState>;
