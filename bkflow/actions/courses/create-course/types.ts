import { z } from "zod";
import type { Course } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { CreateCourse } from "./schema";

export type InputType = z.infer<typeof CreateCourse>;
export type ReturnType = ActionState<InputType, Course>;
