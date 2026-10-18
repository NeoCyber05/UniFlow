import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/calendar/page.tsx.
export const loadBoardCalendar = async ({ boardId }: { boardId: string }, userId: string, orgId: string | null) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/organization/${orgId ?? ""}?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const boardOrgId = currentMembership.membership.board.orgId;

  const lists = await db.list.findMany({
    where: {
      boardId,
      archivedAt: null,
      board: {
        orgId: boardOrgId,
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
  });

  return {
    boardId,
    lists,
    currentUserId: userId,
    currentBoardMemberId: currentMembership.membership.id,
  } as const;
};
