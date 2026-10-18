import { z } from "zod";
import type { Semester } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";
import { SeedDefaultSemesters } from "./schema";

export type InputType = z.infer<typeof SeedDefaultSemesters>;
export type ReturnType = ActionState<InputType, Semester[]>;
