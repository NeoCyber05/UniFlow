import { serializeTaskDates } from "@/lib/cards/task-schedule-storage";
import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { measureDev } from "@/lib/perf";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const card = await measureDev(`api:card:${cardId}:detail`, () => db.card.findFirst({
      where: {
        id: cardId,
        list: {
          board: {
            userId,
          },
        },
      },
      include: {
        list: {
          select: {
            title: true,
            boardId: true,
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
          include: {
            blockerCard: {
              select: {
                id: true,
                title: true,
                isCompleted: true,
                archivedAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        blockingDependencies: {
          include: {
            blockedCard: {
              select: {
                id: true,
                title: true,
                isCompleted: true,
                archivedAt: true,
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
        attachments: {
          orderBy: [
            {
              type: "asc",
            },
            {
              order: "asc",
            },
            {
              createdAt: "desc",
            },
          ],
        },
        checklists: {
          include: {
            items: {
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    }));

    if (!card) {
      return new Response("Not Found", { status: 404 });
    }

    const permission = await requireBoardMember({
      boardId: card.list.boardId,
      userId,
    });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const [boardLabels, boardChecklists] = await measureDev(
      `api:card:${cardId}:board-related`,
      () => Promise.all([
        db.label.findMany({
          where: {
            boardId: card.list.boardId,
          },
          orderBy: {
            createdAt: "asc",
          },
        }),
        db.checklist.findMany({
          where: {
            card: {
              archivedAt: null,
              list: {
                archivedAt: null,
                boardId: card.list.boardId,
              },
            },
          },
          include: {
            items: {
              orderBy: {
                order: "asc",
              },
            },
            card: {
              select: {
                title: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        }),
      ]),
    );

    return Response.json({
      ...card,
      ...serializeTaskDates(card),
      assignees: [],
      boardMembers: [],
      boardLabels,
      boardChecklists,
      currentMemberRole: "ADMIN",
    });
  } catch (error) {
    console.error("[CARD_GET_ERROR]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
