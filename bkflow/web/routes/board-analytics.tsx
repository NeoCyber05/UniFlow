import { Navigate, useParams } from "react-router";

import type { loadBoardAnalytics } from "@/server/views/board-analytics";
import { BoardAnalyticsView } from "@/app/(platform)/(dashboard)/board/[boardId]/analytics/_components/board-analytics-view";
import { Skeleton } from "@/components/ui/skeleton";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardAnalytics>>;

export default function BoardAnalyticsRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}/analytics`);

  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <BoardAnalyticsView
      boardId={data.boardId}
      kpis={data.kpis}
      listDistribution={data.listDistribution}
      workload={data.workload}
      scheduleHealth={data.scheduleHealth}
      insights={data.insights}
      boardType={data.boardType}
      courseBreakdown={data.courseBreakdown}
    />
  );
}
