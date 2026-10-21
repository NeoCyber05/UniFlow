import { z } from "zod";

export const RankAiPriorities = z.object({
  boardId: z.string(),
  /** Việc làm được ngay, theo thứ tự heuristic hiện tại. */
  cardIds: z.array(z.string()).min(1).max(60),
  request: z.string().trim().min(1, { message: "Hãy nói bạn muốn ưu tiên thế nào." }).max(300),
});
