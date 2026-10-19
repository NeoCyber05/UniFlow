import { z } from "zod";

import { ACCENT_IDS, BACKGROUND_IDS } from "@/constants/appearance";
import { PageStyleSchema } from "@/lib/notes/page-style";

export const UpdateAppearance = z.object({
  accent: z.enum(ACCENT_IDS).optional(),
  background: z.enum(BACKGROUND_IDS).optional(),
  pageStyle: PageStyleSchema.optional(),
  expectedUserId: z.string().min(1).optional(),
}).refine(value => value.accent !== undefined || value.background !== undefined || value.pageStyle !== undefined, { message: "Chưa có thay đổi giao diện." });
