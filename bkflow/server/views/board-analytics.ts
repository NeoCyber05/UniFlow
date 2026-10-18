import { getBoardAnalyticsData } from "@/lib/analytics/board-report-data";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/analytics/page.tsx.
export const loadBoardAnalytics = async ({ boardId }: { boardId: string }, userId: string, orgId: string | null) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/organization/${orgId ?? ""}?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const analytics = await getBoardAnalyticsData({
    boardId,
    orgId: currentMembership.membership.board.orgId,
  });

  return {
    boardId,
    kpis: analytics.kpis,
    listDistribution: analytics.listDistribution,
    workload: analytics.workload,
    scheduleHealth: analytics.scheduleHealth,
    insights: analytics.insights,
    boardType: analytics.boardType,
    courseBreakdown: analytics.courseBreakdown,
  } as const;
};
