import { auth } from "@/server/auth";
import { z } from "zod";

import { db } from "@/lib/db";
import { canUndoAiNoteEdit } from "@/lib/notes/ai-undo";
import { getPersonalNoteScope, syncNoteDeadlines } from "@/lib/notes/server";

const RequestBody = z.object({ changeId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return Response.json({ error: "Không tìm thấy trang." }, { status: 404 });
  const parsed = RequestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu hoàn tác không hợp lệ." }, { status: 400 });
  const { pageId } = await params;
  try {
    const result = await db.$transaction(async tx => {
      const change = await tx.aiNoteEdit.findFirst({ where: { id: parsed.data.changeId, ...scope, notePageId: pageId } });
      const current = await tx.notePage.findFirst({ where: { id: pageId, ...scope } });
      if (!change || !current) return { error: "Không tìm thấy thay đổi cần hoàn tác.", status: 404 as const };
      const state = canUndoAiNoteEdit({ undoneAt: change.undoneAt, appliedUpdatedAt: change.appliedUpdatedAt, pageUpdatedAt: current.updatedAt });
      if (state === "already-undone") return { error: "Thay đổi này đã được hoàn tác.", status: 409 as const };
      if (state === "conflict") return { error: "Trang đã có chỉnh sửa mới hơn. Bản mới được giữ nguyên, nên thay đổi AI này không thể hoàn tác tự động.", status: 409 as const };
      const updated = await tx.notePage.updateMany({ where: { id: pageId, ...scope, updatedAt: change.appliedUpdatedAt }, data: { content: change.beforeContent, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } });
      if (!updated.count) return { error: "Trang vừa thay đổi. Bản mới được giữ nguyên.", status: 409 as const };
      await syncNoteDeadlines(tx, { userId: scope.userId, pageId, content: change.beforeContent });
      const marked = await tx.aiNoteEdit.updateMany({ where: { id: change.id, ...scope, undoneAt: null }, data: { undoneAt: new Date() } });
      if (!marked.count) throw new Error("Undo record changed concurrently.");
      return { page: await tx.notePage.findUniqueOrThrow({ where: { id: pageId } }) };
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ page: result.page });
  } catch {
    return Response.json({ error: "Không hoàn tác được thay đổi. Trang hiện tại vẫn được giữ nguyên." }, { status: 409 });
  }
}
