import { auth } from "@/server/auth";

import { getBoardCourses, type BoardCoursesResponse } from "@/lib/courses/board-courses";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const permission = await requireBoardMember({ boardId, userId });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const [board, courses] = await Promise.all([
      db.board.findFirst({
        where: { id: boardId, userId },
        select: { boardType: true },
      }),
      getBoardCourses(boardId),
    ]);

    if (!board) {
      return new Response("Not found", { status: 404 });
    }

    return Response.json({
      boardType: board.boardType,
      courses,
    } satisfies BoardCoursesResponse);
  } catch {
    return new Response("Internal Error", { status: 500 });
  }
}
