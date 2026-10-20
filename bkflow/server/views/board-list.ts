import { BoardType } from "@prisma/client";

import { db } from "@/lib/db";
import { getBoardTaskGroups } from "@/lib/my-tasks/board-tasks";
import { getTodoTasks } from "@/lib/my-tasks/query";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/list/page.tsx.
export const loadBoardList = async ({ boardId, group }: { boardId: string; group?: string }, userId: string) => {
  const permission = await requireBoardMemberForUser({ boardId, userId });

  if (permission.error || !permission.membership) {
    const message = permission.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/my/today?error=${encodeURIComponent(message)}` } as const;
  }

  const board = await db.board.findUnique({
    where: { id: boardId },
    select: {
      boardType: true,
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
  });

  if (!board) {
    return { redirect: "/my/today" } as const;
  }

  const isSemesterBoard = board.boardType === BoardType.SEMESTER;

  // Only the active grouping is preloaded; the other one is fetched by the client when the user switches.
  // shortcut: a stored "list" mode without ?group=list still refetches client-side once, add the mode to the URL if it matters.
  const wantsAgenda = isSemesterBoard && group !== "list";
  const [initialListData, initialAgendaData] = await Promise.all([
    wantsAgenda ? Promise.resolve(undefined) : getBoardTaskGroups({ boardId, userId }),
    wantsAgenda ? getTodoTasks({ userId, boardId }) : Promise.resolve(undefined),
  ]);

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
    initialData: initialListData,
    initialAgendaData,
  } as const;
};
