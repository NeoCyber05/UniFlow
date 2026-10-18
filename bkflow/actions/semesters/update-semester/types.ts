import { z } from "zod";
import { Semester } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { UpdateSemester } from "./schema";

export type InputType = z.infer<typeof UpdateSemester>;
export type ReturnType = ActionState<InputType, Semester>;
