import { db } from "@/lib/db";
import { measureDev } from "@/lib/perf";
import { requireBoardMemberForUser } from "@/lib/permissions";
import type { CardWithAssignees, ListWithCards } from "@/types";

// Data of app/(platform)/(dashboard)/board/[boardId]/page.tsx.
export const loadBoardKanban = async ({ boardId }: { boardId: string }, userId: string) => {
  // The ownership check runs alongside the data queries; both queries are scoped to the user's own board.
  const [currentMembership, listsData, checklistSummaries] = await Promise.all([
    requireBoardMemberForUser({ boardId, userId }),
    measureDev(`board:${boardId}:initial-data`, () =>
      db.list.findMany({
        where: {
          boardId,
          archivedAt: null,
          board: {
            userId,
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
              deadlineOn: true,
              scheduledOn: true,
              scheduledStartAt: true,
              scheduledEndAt: true,
              isCompleted: true,
              kind: true,
              reminder: true,
              reminderSetAt: true,
              reminderGeneration: true,
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
                  myDayAt: true,
                },
              },
              createdAt: true,
              updatedAt: true,
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
    ),
    measureDev(`board:${boardId}:checklist-progress`, () => db.checklist.findMany({
      where: {
        card: {
          archivedAt: null,
          list: { boardId, archivedAt: null, board: { userId } },
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
    })),
  ]);

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/my/today?error=${encodeURIComponent(errorMessage)}` } as const;
  }

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
      assignees: [],
      isImportant: userStates[0]?.isImportant ?? false,
      myDayAt: userStates[0]?.myDayAt ?? null,
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
    boardMembers: [] as any[],
    currentUserId: userId,
    currentMemberRole: "ADMIN" as const,
  } as const;
};
