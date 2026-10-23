import { z } from "zod";

// Thứ tự "Làm gì trước?" của một người trên một bảng; server lưu và trả về nguyên dạng này
export const graphPlanSchema = z.object({
  arranged: z.enum(["auto", "ai"]).nullable(),
  range: z.enum(["today", "week", "month"]),
  aiOrder: z
    .object({
      order: z.array(z.object({ cardId: z.string().min(1), reason: z.string().max(160) })).max(200),
      summary: z.string().max(300),
      request: z.string().max(300),
    })
    .nullable(),
});

export type GraphPlan = z.infer<typeof graphPlanSchema>;
