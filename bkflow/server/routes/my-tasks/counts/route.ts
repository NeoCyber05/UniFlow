import { auth } from "@/server/auth";

import { getMyTaskCounts } from "@/lib/my-tasks/counts";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    return Response.json(await getMyTaskCounts(userId));
  } catch (error) {
    console.error("[MY_TASKS_COUNTS_GET]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
