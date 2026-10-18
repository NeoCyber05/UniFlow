import { z } from "zod";
import type { Course } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { UpdateCourse } from "./schema";

export type InputType = z.infer<typeof UpdateCourse>;
export type ReturnType = ActionState<InputType, Course>;
