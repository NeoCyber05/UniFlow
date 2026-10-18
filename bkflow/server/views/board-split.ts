import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/split/page.tsx.
export const loadBoardSplit = async ({ boardId }: { boardId: string }, userId: string) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/my/today?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const boardUserId = currentMembership.membership.board.userId;

  const rawLists = await db.list.findMany({
    where: {
      boardId,
      archivedAt: null,
      board: {
        userId: boardUserId,
      },
    },
    include: {
      cards: {
        where: {
          archivedAt: null,
        },
        include: {
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

  const lists = rawLists.map((list) => ({
    ...list,
    cards: list.cards.map((card) => ({
      ...card,
      assignees: [],
    })),
  }));

  const calendarLists = lists.map((list) => ({
    id: list.id,
    title: list.title,
    order: list.order,
  }));

  return {
    boardId,
    lists,
    calendarLists,
    boardMembers: [] as any[],
    currentUserId: userId,
    currentBoardMemberId: currentMembership.membership.id,
    currentMemberRole: "ADMIN" as const,
  } as const;
};
