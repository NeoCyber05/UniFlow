import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { ReorderCourses } from "./schema";

export type InputType = z.infer<typeof ReorderCourses>;
export type ReturnType = ActionState<InputType, { count: number }>;
