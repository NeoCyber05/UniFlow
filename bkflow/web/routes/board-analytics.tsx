import { Navigate, useParams } from "react-router";

import type { loadBoardAnalytics } from "@/server/views/board-analytics";
import { BoardAnalyticsView } from "@/app/(platform)/(dashboard)/board/[boardId]/analytics/_components/board-analytics-view";
import { ViewLoadError, ViewSkeleton } from "@/components/view-skeleton";

import { useView } from "../lib/use-view";
import { isUnavailableViewError } from "@/lib/fetcher";

type View = Awaited<ReturnType<typeof loadBoardAnalytics>>;

export default function BoardAnalyticsRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data, isError, error, refetch } = useView<View>(`/board/${boardId}/analytics`);

  if (isError && (!data || isUnavailableViewError(error))) return <ViewLoadError retry={refetch} />;
  if (!data) return <ViewSkeleton variant="panels" />;
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
