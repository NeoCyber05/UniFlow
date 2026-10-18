import { readPageStyle } from "@/lib/notes/page-style";
import { findOwnedNote, getPersonalNoteScope } from "@/lib/notes/server";
import { getMyTasksContext } from "@/lib/my-tasks/context";
import { getTodoTasks } from "@/lib/my-tasks/query";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/pages/[pageId]/page.tsx.
export const loadPage = async ({ pageId }: { pageId: string }, userId: string | null) => {
  if (!userId) return { redirect: "/select-org" } as const;
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return { notFound: true } as const;
  const page = await findOwnedNote(scope, pageId);
  if (!page) return { notFound: true } as const;
  const context = await getMyTasksContext(userId);
  const boardId = context.board?.id ?? null;
  let tasks: { id: string; title: string; dueDate: string | null; boardId: string }[] = [];
  if (boardId) {
    const permission = await requireBoardMemberForUser({ boardId, userId });
    if (!permission.error) tasks = (await getTodoTasks({ userId, boardId })).groups.flatMap(group => group.tasks).map(task => ({ id: task.id, title: task.title, dueDate: task.dueDate, boardId: task.boardId }));
  }
  return { initialPage: { ...page, style: page.style ? readPageStyle(page.style) : null, updatedAt: page.updatedAt.toISOString() }, tasks } as const;
};
