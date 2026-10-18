import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";
import type { CardContext } from "@/lib/my-tasks/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { cardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const card = await db.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        title: true,
        list: { select: { board: { select: { id: true, title: true, userId: true } } } },
        userStates: { where: { userId }, select: { isImportant: true, myDayAt: true } },
      },
    });

    if (!card) {
      return new Response("Not Found", { status: 404 });
    }

    const permission = await requireBoardMemberForUser({ boardId: card.list.board.id, userId });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const state = card.userStates[0];
    const body: CardContext = {
      cardId: card.id,
      title: card.title,
      boardId: card.list.board.id,
      boardTitle: card.list.board.title,
      userId: card.list.board.userId,
      isImportant: state?.isImportant ?? false,
      myDayAt: state?.myDayAt?.toISOString() ?? null,
    };

    return Response.json(body);
  } catch (error) {
    console.error("[CARD_CONTEXT_GET]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
