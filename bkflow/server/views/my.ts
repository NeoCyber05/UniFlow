import { getMyTasksContext } from "@/lib/my-tasks/context";
import { resolveCurrentWorkspaceBoardId } from "@/lib/my-tasks/current-workspace-board";
import { getPersonalBoardDestination } from "@/lib/my-tasks/personal-navigation";
import { getTodoTasks } from "@/lib/my-tasks/query";
import { requireBoardMemberForUser } from "@/lib/permissions";

const PERSONAL_VIEWS = ["today", "courses", "tasks", "calendar", "upcoming", "important"];

// Data of app/(platform)/(dashboard)/my/[view]/page.tsx.
export const loadMy = async ({ view, error }: { view: string; error?: string }, userId: string | null) => {
  if (!userId) {
    return { redirect: "/select-org" } as const;
  }

  if (!PERSONAL_VIEWS.includes(view)) {
    return { notFound: true } as const;
  }

  // Views that only redirect need just the board id (always the user's own board), not the full context.
  const currentBoardId = await resolveCurrentWorkspaceBoardId(userId);
  const destination = !currentBoardId || (view === "today" && error) ? null : getPersonalBoardDestination(view, currentBoardId); // error redirects land here; don't bounce back
  if (destination) {
    const separator = destination.includes("?") ? "&" : "?";
    return { redirect: error ? `${destination}${separator}error=${encodeURIComponent(error)}` : destination } as const;
  }

  const context = await getMyTasksContext(userId);
  const boardId = context.board?.id;

  if (boardId) {
    const permission = await requireBoardMemberForUser({ boardId, userId });
    if (permission.error || !permission.membership) return { notFound: true } as const;

    const now = new Date();
    const data = await getTodoTasks({ userId, boardId, now });
    return {
      boardId,
      context,
      data,
      now: now.toISOString(),
      canEdit: true,
      error,
    } as const;
  }

  return { empty: true } as const;
};
