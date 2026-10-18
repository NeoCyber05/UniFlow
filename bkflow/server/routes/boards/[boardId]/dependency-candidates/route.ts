import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import type { BoardDependencyCandidatesResponse } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const lists = await db.list.findMany({
      where: {
        board: {
          id: boardId,
          orgId,
        },
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
        cards: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
            isCompleted: true,
            startDate: true,
            dueDate: true,
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

    const response: BoardDependencyCandidatesResponse = {
      lists: lists.map((list) => ({
        listId: list.id,
        listTitle: list.title,
        cards: list.cards.map((card) => ({
          id: card.id,
          title: card.title,
          isCompleted: card.isCompleted,
          startDate: card.startDate?.toISOString() ?? null,
          dueDate: card.dueDate?.toISOString() ?? null,
        })),
      })),
    };

    return Response.json(response);
  } catch (error) {
    console.error("[BOARD_DEPENDENCY_CANDIDATES_GET_ERROR]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
