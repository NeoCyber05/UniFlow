import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

const isArchivedType = (value: string | null): value is "lists" | "cards" =>
  value === "lists" || value === "cards";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const type = new URL(request.url).searchParams.get("type");

    if (!isArchivedType(type)) {
      return Response.json(
        { error: "Invalid archived item type." },
        { status: 400 },
      );
    }

    const permission = await requireBoardMember({ boardId, userId });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const query = new URL(request.url).searchParams.get("q")?.trim();
    const titleFilter = query
      ? {
          title: {
            contains: query,
          },
        }
      : {};

    if (type === "lists") {
      const lists = await db.list.findMany({
        where: {
          boardId,
          archivedAt: {
            not: null,
          },
          ...titleFilter,
          board: {
            userId,
          },
        },
        select: {
          id: true,
          title: true,
          boardId: true,
          archivedAt: true,
          _count: {
            select: {
              cards: true,
            },
          },
        },
        orderBy: [
          {
            archivedAt: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
      });

      return Response.json({ items: lists });
    }

    const cards = await db.card.findMany({
      where: {
        archivedAt: {
          not: null,
        },
        ...titleFilter,
        list: {
          board: {
            id: boardId,
            userId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        listId: true,
        archivedAt: true,
        list: {
          select: {
            title: true,
            archivedAt: true,
            boardId: true,
          },
        },
      },
      orderBy: [
        {
          archivedAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    return Response.json({
      items: cards.map((card) => ({
        id: card.id,
        title: card.title,
        listId: card.listId,
        listTitle: card.list.title,
        boardId: card.list.boardId,
        archivedAt: card.archivedAt,
        listArchivedAt: card.list.archivedAt,
      })),
    });
  } catch (error) {
    console.error("[BOARD_ARCHIVED_GET_ERROR]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
