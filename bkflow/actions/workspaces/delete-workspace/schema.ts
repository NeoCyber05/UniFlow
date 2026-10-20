import { z } from "zod";

export const DeleteWorkspace = z.object({ id: z.string() });
