import { auth } from "@/server/auth";
import { z } from "zod";

import { getAssistantApiKey } from "@/lib/ai/assistant/config";
import { createThread, listAssistantBoards, listThreads } from "@/lib/ai/assistant/threads";
import { logger } from "@/lib/logger";
import { resolveCurrentWorkspaceBoardId } from "@/lib/my-tasks/current-workspace-board";

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Danh sách cuộc trò chuyện, các bảng chọn làm phạm vi và bảng mặc định (workspace hiện tại). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return fail("Bạn cần đăng nhập.", 401);
  try {
    const [threads, boards, defaultBoardId] = await Promise.all([
      listThreads(userId),
      listAssistantBoards(userId),
      resolveCurrentWorkspaceBoardId(userId),
    ]);
    return Response.json({
      threads,
      boards: boards.map((board) => ({ id: board.id, title: board.title })),
      defaultBoardId,
      enabled: Boolean(getAssistantApiKey()),
    });
  } catch (error) {
    logger.error("[AI_THREADS_LIST_ERROR]", error, { action: "ai-threads-list" });
    return fail("Chưa tải được các cuộc trò chuyện.", 500);
  }
}

const Body = z.object({ boardId: z.string().min(1).max(100).optional() });

/** Tạo cuộc trò chuyện mới; phạm vi mặc định là bảng của workspace hiện tại. */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return fail("Bạn cần đăng nhập.", 401);
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("Yêu cầu không hợp lệ.", 400);
  const boards = await listAssistantBoards(userId);
  const boardId = parsed.data.boardId ?? (await resolveCurrentWorkspaceBoardId(userId));
  if (!boardId || !boards.some((board) => board.id === boardId)) return fail("Không có quyền dùng bảng này.", 403);
  return Response.json({ thread: await createThread(userId, boardId) }, { status: 201 });
}
