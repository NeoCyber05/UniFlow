import { z } from "zod";
import { Card } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { SetCardCompleted } from "./schema";

export type InputType = z.infer<typeof SetCardCompleted>;
export type ReturnType = ActionState<InputType, Card>;
