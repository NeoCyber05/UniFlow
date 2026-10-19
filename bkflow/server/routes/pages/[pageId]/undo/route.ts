import { auth } from "@/server/auth";
import { z } from "zod";

import { db } from "@/lib/db";
import { canUndoAiNoteEdit } from "@/lib/notes/ai-undo";
import { getPersonalNoteScope, syncNoteDeadlines } from "@/lib/notes/server";
import { canonicalizeConvertedContent } from "@/lib/notes/legacy-task-conversion";

const RequestBody = z.object({ changeId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return Response.json({ error: "Không tìm thấy trang." }, { status: 404 });
  const parsed = RequestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu hoàn tác không hợp lệ." }, { status: 400 });
  const { pageId } = await params;
  const { changeId } = parsed.data;
  // Repeated undo is a stable success with the current page; nothing is reverted twice.
  const alreadyUndone = async () => {
    const [change, page] = await Promise.all([
      db.aiNoteEdit.findFirst({ where: { id: changeId, ...scope, notePageId: pageId } }),
      db.notePage.findFirst({ where: { id: pageId, ...scope } }),
    ]);
    return change?.undoneAt && page ? Response.json({ page, alreadyUndone: true }) : null;
  };
  try {
    const result = await db.$transaction(async tx => {
      const change = await tx.aiNoteEdit.findFirst({ where: { id: changeId, ...scope, notePageId: pageId } });
      const current = await tx.notePage.findFirst({ where: { id: pageId, ...scope } });
      if (!change || !current) return { error: "Không tìm thấy thay đổi cần hoàn tác.", status: 404 as const };
      const state = canUndoAiNoteEdit({ undoneAt: change.undoneAt, appliedUpdatedAt: change.appliedUpdatedAt, pageUpdatedAt: current.updatedAt });
      if (state === "already-undone") return { page: current, alreadyUndone: true };
      // Owner-scoped contents so the client can show before/after/current; the newer edit is kept.
      if (state === "conflict") return {
        error: "Trang đã có chỉnh sửa mới hơn. Bản mới được giữ nguyên, nên thay đổi AI này không thể hoàn tác tự động.", status: 409 as const,
        conflict: { beforeContent: change.beforeContent, afterContent: change.afterContent, currentContent: current.content, appliedUpdatedAt: change.appliedUpdatedAt, currentUpdatedAt: current.updatedAt },
      };
      // Old undo content may still hold legacy blocks that were converted since; they come back as task refs.
      const content = await canonicalizeConvertedContent(tx, { pageId, content: change.beforeContent });
      const updated = await tx.notePage.updateMany({ where: { id: pageId, ...scope, updatedAt: change.appliedUpdatedAt }, data: { content, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } });
      // Lost the CAS (concurrent undo or edit): the catch re-reads to tell already-undone from conflict.
      if (!updated.count) throw new Error("Page changed concurrently.");
      await syncNoteDeadlines(tx, { userId: scope.userId, pageId, content });
      const marked = await tx.aiNoteEdit.updateMany({ where: { id: change.id, ...scope, undoneAt: null }, data: { undoneAt: new Date() } });
      if (!marked.count) throw new Error("Undo record changed concurrently.");
      return { page: await tx.notePage.findUniqueOrThrow({ where: { id: pageId } }), alreadyUndone: false };
    });
    if ("error" in result) return Response.json({ error: result.error, conflict: "conflict" in result ? result.conflict : undefined }, { status: result.status });
    return Response.json(result);
  } catch {
    return await alreadyUndone().catch(() => null) ?? Response.json({ error: "Không hoàn tác được thay đổi. Trang hiện tại vẫn được giữ nguyên." }, { status: 409 });
  }
}
