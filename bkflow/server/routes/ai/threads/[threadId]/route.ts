import { auth } from "@/server/auth";
import { z } from "zod";

import { deleteThread, getThread, listAssistantBoards, loadThreadMessages, THREAD_DISPLAY_MESSAGES, updateThread } from "@/lib/ai/assistant/threads";

const fail = (error: string, status: number) => Response.json({ error }, { status });
type Ctx = { params: Promise<{ threadId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return fail("Bạn cần đăng nhập.", 401);
  const { threadId } = await params;
  const thread = await getThread(userId, threadId);
  if (!thread) return fail("Không tìm thấy cuộc trò chuyện.", 404);
  return Response.json({ thread, messages: await loadThreadMessages(thread.id, THREAD_DISPLAY_MESSAGES) });
}

const Patch = z.object({
  title: z.string().max(120).optional(),
  pinned: z.boolean().optional(),
  boardId: z.string().min(1).max(100).optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return fail("Bạn cần đăng nhập.", 401);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Yêu cầu không hợp lệ.", 400);
  if (parsed.data.boardId) {
    const boards = await listAssistantBoards(userId);
    if (!boards.some((board) => board.id === parsed.data.boardId)) return fail("Không có quyền dùng bảng này.", 403);
  }
  const { threadId } = await params;
  if (!(await updateThread(userId, threadId, parsed.data))) return fail("Không tìm thấy cuộc trò chuyện.", 404);
  return Response.json({ thread: await getThread(userId, threadId) });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return fail("Bạn cần đăng nhập.", 401);
  const { threadId } = await params;
  if (!(await deleteThread(userId, threadId))) return fail("Không tìm thấy cuộc trò chuyện.", 404);
  return Response.json({ ok: true });
}
