import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const board = await db.board.findFirst({
      where: {
        id: boardId,
        userId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!board) {
      return new Response("Not Found", { status: 404 });
    }

    const permission = await requireBoardMember({ boardId, userId });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    return Response.json(board);
  } catch (error) {
    console.error("[BOARD_GET_ERROR]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
