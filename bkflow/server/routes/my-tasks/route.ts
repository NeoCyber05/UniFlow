import { auth } from "@/server/auth";

import { getTodoTasks } from "@/lib/my-tasks/query";
import { requireBoardMemberForUser } from "@/lib/permissions";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const boardId = new URL(req.url).searchParams.get("boardId");

    if (!boardId) {
      return new Response("Missing boardId", { status: 400 });
    }

    const permission = await requireBoardMemberForUser({ boardId, userId });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    return Response.json(await getTodoTasks({ userId, boardId }));
  } catch (error) {
    console.error("[MY_TASKS_GET]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
