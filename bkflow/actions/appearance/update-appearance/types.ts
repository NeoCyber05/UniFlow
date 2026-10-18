import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";
import { Appearance } from "@/constants/appearance";
import { UpdateAppearance } from "./schema";

export type InputType = z.infer<typeof UpdateAppearance>;
export type ReturnType = ActionState<InputType, Appearance>;
