import { z } from "zod";
import type { Card } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { SetCardCourse } from "./schema";

export type InputType = z.infer<typeof SetCardCourse>;
export type ReturnType = ActionState<InputType, Card>;
