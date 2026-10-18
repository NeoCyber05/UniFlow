import { auth } from "@/server/clerk";

import { getMyTasksContext } from "@/lib/my-tasks/context";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    return Response.json(await getMyTasksContext(userId));
  } catch (error) {
    console.error("[MY_TASKS_CONTEXT_GET]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
