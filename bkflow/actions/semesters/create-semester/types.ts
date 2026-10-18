import { z } from "zod";
import { Semester } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { CreateSemester } from "./schema";

export type InputType = z.infer<typeof CreateSemester>;
export type ReturnType = ActionState<InputType, Semester>;
