import { BoardMemberRole } from "@prisma/client";

import { db } from "@/lib/db";
import { measureDev } from "@/lib/perf";
import { requireBoardMemberForUser } from "@/lib/permissions";
import type { CardWithAssignees, ListWithCards } from "@/types";

// Data of app/(platform)/(dashboard)/board/[boardId]/page.tsx.
export const loadBoardKanban = async ({ boardId }: { boardId: string }, userId: string, orgId: string | null) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/organization/${orgId ?? ""}?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const boardOrgId = currentMembership.membership.board.orgId;
  
  const [listsData, boardMembers] = await measureDev(`board:${boardId}:initial-data`, () => Promise.all([
    db.list.findMany({
      where: {
        boardId,
        archivedAt: null,
        board: {
          orgId: boardOrgId,
        },
      },
      select: {
        id: true,
        title: true,
        order: true,
        archivedAt: true,
        boardId: true,
        createdAt: true,
        updatedAt: true,
        cards: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
            order: true,
            description: true,
            descriptionUpdatedAt: true,
            startDate: true,
            dueDate: true,
            isCompleted: true,
            reminder: true,
            reminderSetAt: true,
            archivedAt: true,
            archivedByListId: true,
            listId: true,
            courseId: true,
            userStates: {
              where: {
                userId,
              },
              select: {
                isImportant: true,
              },
            },
            createdAt: true,
            updatedAt: true,
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
            blockedByDependencies: {
              where: {
                blockerCard: {
                  isCompleted: false,
                },
              },
              select: {
                id: true,
              },
            },
            _count: {
              select: {
                comments: true,
                attachments: true,
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
    }),
    db.boardMember.findMany({
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
    }),
  ]));

  const cardIds = listsData.flatMap((list) => list.cards.map((card) => card.id));
  const checklistSummaries = cardIds.length > 0
    ? await measureDev(`board:${boardId}:checklist-progress`, () => db.checklist.findMany({
        where: {
          cardId: {
            in: cardIds,
          },
        },
        select: {
          cardId: true,
          items: {
            select: {
              isCompleted: true,
            },
          },
        },
      }))
    : [];
  const checklistProgressByCardId = new Map<string, { total: number; completed: number }>();

  checklistSummaries.forEach((checklist) => {
    const current = checklistProgressByCardId.get(checklist.cardId) ?? {
      total: 0,
      completed: 0,
    };

    current.total += checklist.items.length;
    current.completed += checklist.items.filter((item) => item.isCompleted).length;
    checklistProgressByCardId.set(checklist.cardId, current);
  });

  const lists = listsData.map((list) => ({
    ...list,
    cards: list.cards.map(({ userStates, ...card }) => ({
      ...card,
      isImportant: userStates[0]?.isImportant ?? false,
      checklistProgress: checklistProgressByCardId.get(card.id) ?? {
        total: 0,
        completed: 0,
      },
      unresolvedBlockerCount: card.blockedByDependencies.length,
    })) as CardWithAssignees[],
  })) as ListWithCards[];

  return {
    boardId,
    lists,
    boardMembers,
    currentUserId: userId,
    currentMemberRole: currentMembership.membership.role,
  } as const;
};
