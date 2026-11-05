import { auth } from "@/server/auth";
import { z } from "zod";

import { logger } from "@/lib/logger";

const Body = z.object({
  messageId: z.string().min(1).max(100),
  rating: z.enum(["up", "down"]),
  reason: z.enum(["wrong_info", "not_what_asked", "unclear"]).optional(),
});

/** Góp ý Hữu ích / Chưa đúng cho một câu trả lời của trợ lý; chỉ ghi log để theo dõi chất lượng. */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  logger.info("[AI_ASSISTANT_FEEDBACK]", { action: "ai-assistant-feedback", userId, ...parsed.data });
  return Response.json({ ok: true });
}
