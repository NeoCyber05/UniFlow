import { BoardMemberRole, BoardType } from "@prisma/client";

import { db } from "@/lib/db";
import { getBoardTaskGroups } from "@/lib/my-tasks/board-tasks";
import { getTodoTasks } from "@/lib/my-tasks/query";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/list/page.tsx.
export const loadBoardList = async ({ boardId }: { boardId: string }, userId: string, orgId: string | null) => {
  const permission = await requireBoardMemberForUser({ boardId, userId });

  if (permission.error || !permission.membership) {
    const message = permission.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/organization/${orgId ?? ""}?error=${encodeURIComponent(message)}` } as const;
  }

  const board = await db.board.findUnique({
    where: { id: boardId },
    select: {
      boardType: true,
      orgId: true,
      lists: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, title: true },
      },
      members: {
        orderBy: { createdAt: "asc" },
        select: { id: true, userName: true, userEmail: true, role: true },
      },
      labels: {
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, color: true },
      },
    },
  });

  if (!board) {
    return { redirect: `/organization/${orgId ?? ""}` } as const;
  }

  const isSemesterBoard = board.boardType === BoardType.SEMESTER;

  const [assignableMembers, initialListData, initialAgendaData] = await Promise.all([
    db.boardMember.findMany({
      where: { boardId, role: { not: BoardMemberRole.VIEWER } },
      orderBy: { createdAt: "asc" },
      select: { userId: true, userName: true },
    }),
    getBoardTaskGroups({ boardId, userId }),
    isSemesterBoard ? getTodoTasks({ userId, boardId }) : Promise.resolve(undefined),
  ]);

  return {
    boardId,
    boardOrgId: board.orgId,
    isTeamBoard: board.boardType === BoardType.TEAM_PROJECT,
    canEdit: permission.membership.role !== BoardMemberRole.VIEWER,
    currentBoardMemberId: permission.membership.id,
    assignableMembers,
    lists: board.lists,
    members: board.members,
    labels: board.labels,
    initialData: initialListData,
    initialAgendaData,
  } as const;
};
