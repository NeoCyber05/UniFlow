import { z } from "zod";
import { Card } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { QuickAddCard } from "./schema";

export type InputType = z.infer<typeof QuickAddCard>;
export type ReturnType = ActionState<InputType, Card>;
