import { z } from "zod";
import { Semester } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { SetCurrentSemester } from "./schema";

export type InputType = z.infer<typeof SetCurrentSemester>;
export type ReturnType = ActionState<InputType, Semester>;
