import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { cardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const card = await db.card.findFirst({
      where: {
        id: cardId,
        archivedAt: null,
        list: {
          archivedAt: null,
        },
      },
      select: {
        id: true,
        listId: true,
        _count: {
          select: {
            labels: true,
            attachments: true,
            checklists: true,
            comments: true,
          },
        },
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return new Response("Not Found", { status: 404 });
    }

    const permission = await requireBoardMemberForUser({
      boardId: card.list.boardId,
      userId,
    });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const boards = await db.board.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        title: true,
        userId: true,
        lists: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
            order: true,
            _count: {
              select: {
                cards: {
                  where: {
                    archivedAt: null,
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
        createdAt: "desc",
      },
    });

    const organizations = [
      {
        id: userId,
        name: "Không gian làm việc",
        imageUrl: "",
      },
    ];

    return Response.json({
      currentBoardId: card.list.boardId,
      currentListId: card.listId,
      sourceCounts: {
        checklists: card._count.checklists,
        labels: card._count.labels,
        members: 0,
        attachments: card._count.attachments,
        comments: card._count.comments,
      },
      organizations,
      boards: boards.map((board) => ({
        id: board.id,
        title: board.title,
        userId: board.userId,
        isCurrent: board.id === card.list.boardId,
        lists: board.lists.map((list) => ({
          id: list.id,
          title: list.title,
          order: list.order,
          cardCount: list._count.cards,
          isCurrent: list.id === card.listId,
        })),
      })),
    });
  } catch (error) {
    console.error("[CARD_COPY_OPTIONS_ERROR]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
