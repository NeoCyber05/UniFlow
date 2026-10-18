import { db } from "@/lib/db";
import { measureDev } from "@/lib/perf";
import { requireBoardMemberForUser } from "@/lib/permissions";
import type {
  BoardTimelineBoardMember,
  BoardTimelineDependency,
  BoardTimelineList,
} from "@/types";

// Data of app/(platform)/(dashboard)/board/[boardId]/timeline/page.tsx.
export const loadBoardTimeline = async ({ boardId }: { boardId: string }, userId: string) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/my/today?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const boardUserId = currentMembership.membership.board.userId;

  const listsData = await measureDev(`board:${boardId}:timeline-data`, () =>
    db.list.findMany({
      where: {
        boardId,
        archivedAt: null,
        board: {
          userId: boardUserId,
        },
      },
      select: {
        id: true,
        title: true,
        order: true,
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
            startDate: true,
            dueDate: true,
            isCompleted: true,
            createdAt: true,
            updatedAt: true,
            labels: {
              select: {
                label: {
                  select: {
                    id: true,
                    title: true,
                    color: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
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
            blockedByDependencies: {
              where: {
                blockerCard: {
                  archivedAt: null,
                  list: {
                    archivedAt: null,
                    board: {
                      id: boardId,
                      userId: boardUserId,
                    },
                  },
                },
              },
              select: {
                id: true,
                blockerCard: {
                  select: {
                    id: true,
                    title: true,
                    listId: true,
                    isCompleted: true,
                    startDate: true,
                    dueDate: true,
                    createdAt: true,
                    updatedAt: true,
                    list: {
                      select: {
                        title: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            blockingDependencies: {
              where: {
                blockedCard: {
                  archivedAt: null,
                  list: {
                    archivedAt: null,
                    board: {
                      id: boardId,
                      userId: boardUserId,
                    },
                  },
                },
              },
              select: {
                id: true,
                blockedCard: {
                  select: {
                    id: true,
                    title: true,
                    listId: true,
                    isCompleted: true,
                    startDate: true,
                    dueDate: true,
                    createdAt: true,
                    updatedAt: true,
                    list: {
                      select: {
                        title: true,
                      },
                    },
                  },
                },
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
  );

  const mapDependency = (
    dependency: {
      id: string;
      card: {
        id: string;
        title: string;
        listId: string;
        isCompleted: boolean;
        startDate: Date | null;
        dueDate: Date | null;
        createdAt: Date;
        updatedAt: Date;
        list: {
          title: string;
        };
      };
    },
  ): BoardTimelineDependency => ({
    id: dependency.id,
    cardId: dependency.card.id,
    title: dependency.card.title,
    listId: dependency.card.listId,
    listTitle: dependency.card.list.title,
    isCompleted: dependency.card.isCompleted,
    startDate: dependency.card.startDate?.toISOString() ?? null,
    dueDate: dependency.card.dueDate?.toISOString() ?? null,
    createdAt: dependency.card.createdAt.toISOString(),
    updatedAt: dependency.card.updatedAt.toISOString(),
  });

  const lists: BoardTimelineList[] = listsData.map((list) => ({
    id: list.id,
    title: list.title,
    order: list.order,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    cards: list.cards.map((card) => {
      const checklistProgress = card.checklists.reduce((progress, checklist) => {
        progress.total += checklist.items.length;
        progress.completed += checklist.items.filter((item) => item.isCompleted).length;
        return progress;
      }, {
        total: 0,
        completed: 0,
      });
      const blockedByDependencies = card.blockedByDependencies.map((dependency) =>
        mapDependency({
          id: dependency.id,
          card: dependency.blockerCard,
        }));
      const blockingDependencies = card.blockingDependencies.map((dependency) =>
        mapDependency({
          id: dependency.id,
          card: dependency.blockedCard,
        }));

      return {
        id: card.id,
        title: card.title,
        order: card.order,
        listId: card.listId,
        listTitle: list.title,
        listOrder: list.order,
        courseId: card.courseId,
        isImportant: card.userStates[0]?.isImportant ?? false,
        isCompleted: card.isCompleted,
        startDate: card.startDate?.toISOString() ?? null,
        dueDate: card.dueDate?.toISOString() ?? null,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
        labels: card.labels.map(({ label }) => ({
          id: label.id,
          title: label.title,
          color: label.color,
        })),
        assignees: [],
        commentCount: card._count.comments,
        attachmentCount: card._count.attachments,
        checklistProgress,
        blockedByDependencies,
        blockingDependencies,
        unresolvedBlockerCount: blockedByDependencies.filter((dependency) => !dependency.isCompleted).length,
      };
    }),
  }));
  const boardMembers: BoardTimelineBoardMember[] = [];

  return {
    boardId,
    boardTitle: currentMembership.membership.board.title,
    lists,
    boardMembers,
    currentUserId: userId,
    currentBoardMemberId: currentMembership.membership.id,
    currentMemberRole: "ADMIN" as const,
  } as const;
};
