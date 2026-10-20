import { BoardType } from "@prisma/client";

import { getBoardCourses } from "@/lib/courses/board-courses";
import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

export const loadBoardLayout = async ({ boardId }: { boardId: string }, userId: string) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/my/today?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const boardUserId = currentMembership.membership.board.userId;

  const board = await db.board.findUnique({
    where: {
      id: boardId,
    },
    include: {
      workspace: { select: { id: true, title: true, icon: true, color: true } },
      labels: {
        orderBy: {
          createdAt: "asc",
        },
      },
      lists: {
        where: {
          archivedAt: null,
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!board) {
    return { notFound: true } as const;
  }

  const isWorkspaceBoard = board.boardType === BoardType.WORKSPACE;
  const courses = isWorkspaceBoard ? await getBoardCourses(boardId) : [];

  return {
    title: board.title || "Bảng",
    boardId,
    board,
    boardOrgId: boardUserId,
    boardUserId,
    courses,
    canEdit: true,
    isWorkspaceBoard,
    effectiveOrgMembers: [] as { userId: string; name: string; imageUrl: string; email: string | null }[],
    currentUserId: userId,
    currentMemberRole: "ADMIN" as const,
  } as const;
};
