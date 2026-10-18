import { z } from "zod";
import type { Course } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { DeleteCourse } from "./schema";

export type InputType = z.infer<typeof DeleteCourse>;
export type ReturnType = ActionState<InputType, Course>;
