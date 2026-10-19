import { auth } from "@/server/auth";

import { TaskEditError, undoAiTaskEdit } from "@/lib/ai/assistant/task-edits";
import { logger } from "@/lib/logger";

export async function POST(_request: Request, { params }: { params: Promise<{ editId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401 });
  const { editId } = await params;
  try {
    return Response.json(await undoAiTaskEdit({ userId, editId }));
  } catch (error) {
    if (error instanceof TaskEditError) return Response.json({ error: error.message }, { status: error.status });
    logger.error("[AI_TASK_UNDO_ERROR]", error, { action: "ai-task-undo", editId });
    return Response.json({ error: "Không hoàn tác được thay đổi. Thẻ hiện tại vẫn được giữ nguyên." }, { status: 500 });
  }
}
