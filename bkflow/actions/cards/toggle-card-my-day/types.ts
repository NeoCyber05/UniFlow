import { z } from "zod";
import { CardUserState } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { ToggleCardMyDay } from "./schema";

export type InputType = z.infer<typeof ToggleCardMyDay>;
export type ReturnType = ActionState<InputType, CardUserState>;
