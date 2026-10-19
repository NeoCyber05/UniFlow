import "server-only";

import { db } from "@/lib/db";
import { workspaceBoardScope } from "@/lib/search/workspace-search";
import { MAX_LINKED_TASKS, type LinkedTaskResult } from "./contract";

// Backs GET /api/pages/:pageId/tasks. Permission is the viewer's board scope, never the note.
export const loadLinkedTasks = async ({ userId, pageId, taskIds }: { userId: string; pageId: string; taskIds: string[] }): Promise<LinkedTaskResult[]> => {
  const ids = [...new Set(taskIds.filter(Boolean))].slice(0, MAX_LINKED_TASKS);
  if (!ids.length) return [];
  const page = await db.notePage.findFirst({ where: { id: pageId, userId }, select: { id: true } });
  if (!page) return [];
  const rows = await db.card.findMany({
    where: { id: { in: ids }, archivedAt: null, list: { archivedAt: null, board: workspaceBoardScope(userId) } },
    select: { id: true, title: true, isCompleted: true, dueDate: true, deadlineOn: true, updatedAt: true, list: { select: { boardId: true } } },
  });
  const byId = new Map(rows.map(card => [card.id, card]));
  return ids.map(taskId => {
    const card = byId.get(taskId);
    if (!card) return { taskId, state: "unavailable" as const };
    return {
      taskId,
      state: "available" as const,
      task: {
        id: card.id,
        title: card.title,
        boardId: card.list.boardId,
        isCompleted: card.isCompleted,
        dueDate: card.dueDate?.toISOString() ?? null,
        deadlineOn: card.deadlineOn?.toISOString().slice(0, 10) ?? null,
        updatedAt: card.updatedAt.toISOString(),
      },
    };
  });
};
