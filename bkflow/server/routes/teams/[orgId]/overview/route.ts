import { auth } from "@/server/auth";

import { getOrganizationMember } from "@/lib/clerk-org-members";
import { getTeamOverview } from "@/lib/team-tasks/query";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!(await getOrganizationMember(orgId, userId))) {
      return new Response("Forbidden", { status: 403 });
    }

    return Response.json(await getTeamOverview({ orgId, userId }));
  } catch (error) {
    console.error("[TEAM_OVERVIEW_GET]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
