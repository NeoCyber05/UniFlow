import { z } from "zod";
import { Semester } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { DeleteSemester } from "./schema";

export type InputType = z.infer<typeof DeleteSemester>;
export type ReturnType = ActionState<InputType, Semester>;
