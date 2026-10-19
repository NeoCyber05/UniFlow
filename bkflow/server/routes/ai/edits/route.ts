import { auth } from "@/server/auth";

import { AiTaskEditRequest, applyAiTaskEdit, TaskEditError } from "@/lib/ai/assistant/task-edits";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Applies one previewed AI task edit. A multi-task proposal sends one request (own requestId) per task. */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return fail("Không có quyền truy cập.", 401);
  const parsed = AiTaskEditRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Thay đổi AI không hợp lệ.", 400);
  try {
    return Response.json(await applyAiTaskEdit({ ...parsed.data, userId }));
  } catch (error) {
    if (error instanceof TaskEditError) return fail(error.message, error.status);
    logger.error("[AI_TASK_EDIT_ERROR]", error, { action: "ai-task-edit", cardId: parsed.data.cardId });
    return fail("Chưa áp dụng được thay đổi AI. Thẻ hiện tại vẫn được giữ nguyên.", 500);
  }
}

/** AI edits of one card by the current user, so undo survives a reload. */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return fail("Không có quyền truy cập.", 401);
  const cardId = new URL(request.url).searchParams.get("cardId");
  if (!cardId) return fail("Thiếu cardId.", 400);
  const card = await db.card.findFirst({ where: { id: cardId, archivedAt: null, list: { archivedAt: null, board: { userId } } }, select: { id: true } });
  if (!card) return fail("Không tìm thấy thẻ hoặc bạn không có quyền truy cập.", 404);
  const edits = await db.aiTaskEdit.findMany({
    where: { userId, cardId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, cardId: true, operation: true, createdAt: true, undoneAt: true },
  });
  return Response.json({ edits }, { headers: { "Cache-Control": "private, no-store" } });
}
