import { db } from "@/lib/db";
import { getTodoTasks } from "@/lib/my-tasks/query";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/list/page.tsx.
export const loadBoardList = async ({ boardId }: { boardId: string; group?: string }, userId: string) => {
  const [permission, board] = await Promise.all([
    requireBoardMemberForUser({ boardId, userId }),
    db.board.findFirst({
      where: { id: boardId, userId },
      select: {
        userId: true,
        lists: {
          where: { archivedAt: null },
          orderBy: { order: "asc" },
          select: { id: true, title: true },
        },
        labels: {
          orderBy: { createdAt: "asc" },
          select: { id: true, title: true, color: true },
        },
      },
    }),
  ]);

  if (permission.error || !permission.membership) {
    const message = permission.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/my/today?error=${encodeURIComponent(message)}` } as const;
  }

  if (!board) {
    return { redirect: "/my/today" } as const;
  }

  // Hàng luôn nhóm theo hạn (xem theo cột là layout Kanban), nên chỉ preload agenda.
  const initialAgendaData = await getTodoTasks({ userId, boardId });

  return {
    boardId,
    boardOrgId: board.userId,
    boardUserId: board.userId,
    isTeamBoard: false,
    canEdit: true,
    currentBoardMemberId: permission.membership.id,
    assignableMembers: [] as { userId: string; userName: string }[],
    lists: board.lists,
    members: [] as any[],
    labels: board.labels,
    initialData: undefined,
    initialAgendaData,
  } as const;
};
