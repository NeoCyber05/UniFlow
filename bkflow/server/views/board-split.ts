import { BoardMemberRole } from "@prisma/client";

import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/split/page.tsx.
export const loadBoardSplit = async ({ boardId }: { boardId: string }, userId: string, orgId: string | null) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/organization/${orgId ?? ""}?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const boardOrgId = currentMembership.membership.board.orgId;

  const lists = await db.list.findMany({
    where: {
      boardId,
      archivedAt: null,
      board: {
        orgId: boardOrgId,
      },
    },
    include: {
      cards: {
        where: {
          archivedAt: null,
        },
        include: {
          assignees: {
            where: {
              boardMember: {
                role: {
                  not: BoardMemberRole.VIEWER,
                },
              },
            },
            include: {
              boardMember: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          labels: {
            include: {
              label: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
          checklists: {
            select: {
              items: {
                select: {
                  isCompleted: true,
                },
              },
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
    orderBy: {
      order: "asc",
    },
  });

  const boardMembers = await db.boardMember.findMany({
    where: {
      boardId,
      board: {
        orgId: boardOrgId,
        members: {
          some: {
            userId,
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const calendarLists = lists.map((list) => ({
    id: list.id,
    title: list.title,
    order: list.order,
  }));

  return {
    boardId,
    lists,
    calendarLists,
    boardMembers,
    currentUserId: userId,
    currentBoardMemberId: currentMembership.membership.id,
    currentMemberRole: currentMembership.membership.role,
  } as const;
};
