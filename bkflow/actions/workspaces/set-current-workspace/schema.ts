import { z } from "zod";

export const SetCurrentWorkspace = z.object({ id: z.string() });
