import { z } from "zod";

import { ACCENT_IDS, BACKGROUND_IDS } from "@/constants/appearance";
import { PageStyleSchema } from "@/lib/notes/page-style";

export const UpdateAppearance = z.object({
  accent: z.enum(ACCENT_IDS),
  background: z.enum(BACKGROUND_IDS),
  pageStyle: PageStyleSchema.optional(),
});
