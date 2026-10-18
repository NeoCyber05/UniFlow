import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { getPersonalNoteScope } from "@/lib/notes/server";

export async function GET(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return Response.json({ changes: [] });
  const { pageId } = await params;
  const changes = await db.aiNoteEdit.findMany({ where: { ...scope, notePageId: pageId }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, undoneAt: true } });
  return Response.json({ changes });
}
