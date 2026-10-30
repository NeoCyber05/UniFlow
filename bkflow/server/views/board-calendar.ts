import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

import type { BoardCalendarResponse } from "@/types";

// Data of app/(platform)/(dashboard)/board/[boardId]/calendar/page.tsx.
export const loadBoardCalendar = async ({ boardId }: { boardId: string }, userId: string, _orgId?: string | null) => {
  // The ownership check runs alongside the lists query, which is scoped to the user's own board.
  const [currentMembership, lists] = await Promise.all([
    requireBoardMemberForUser({ boardId, userId }),
    db.list.findMany({
      where: {
        boardId,
        archivedAt: null,
        board: {
          userId,
        },
      },
      select: {
        id: true,
        title: true,
        order: true,
      },
      orderBy: {
        order: "asc",
      },
    }),
  ]);

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/my/today?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  return {
    boardId,
    lists,
    currentUserId: userId,
    currentBoardMemberId: currentMembership.membership.id,
    initialCalendarData: undefined as BoardCalendarResponse | undefined,
  } as const;
};
