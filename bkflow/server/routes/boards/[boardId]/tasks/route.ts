import { auth } from "@/server/clerk";

import { getBoardTaskGroups } from "@/lib/my-tasks/board-tasks";
import { requireBoardMemberForUser } from "@/lib/permissions";

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

    const permission = await requireBoardMemberForUser({ boardId, userId });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    return Response.json(await getBoardTaskGroups({ boardId, userId }));
  } catch (error) {
    console.error("[BOARD_TASKS_GET]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
