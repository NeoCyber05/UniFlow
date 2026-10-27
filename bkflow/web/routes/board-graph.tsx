import { Navigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import type { loadBoardGraph } from "@/server/views/board-graph";
import { BoardCardModalFromUrl } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-card-modal-from-url";
import { BoardGraphView } from "@/app/(platform)/(dashboard)/board/[boardId]/graph/_components/board-graph-view";
import { Skeleton } from "@/components/ui/skeleton";
import type { GraphPlan } from "@/lib/boards/graph-plan";

import { useView, viewQueryOptions } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardGraph>>;

export default function BoardGraphRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const queryClient = useQueryClient();
  const { data, isError, refetch } = useView<View>(`/board/${boardId}/graph`);
  const updatePlan = (plan: GraphPlan) => {
    const { queryKey } = viewQueryOptions<View>(`/board/${boardId}/graph`);
    // Giữ kế hoạch mới khi quay lại tab, kể cả lúc request lưu chưa hoàn tất.
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<View>(queryKey, (current) =>
      current && !current.redirect ? { ...current, plan } : current,
    );
  };

  if (isError) {
    return (
      <div role="alert" className="p-4">
        <p className="text-sm text-neutral-700">Không tải được sơ đồ. Vui lòng thử lại.</p>
        <button type="button" className="mt-3 text-sm underline" onClick={() => void refetch()}>
          Thử lại
        </button>
      </div>
    );
  }
  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="h-full p-4">
      <BoardCardModalFromUrl />
      <BoardGraphView
        boardId={data.boardId}
        boardTitle={data.boardTitle}
        plan={data.plan}
        onPlanChange={updatePlan}
        lists={data.lists}
        boardMembers={data.boardMembers}
        currentUserId={data.currentUserId}
        currentBoardMemberId={data.currentBoardMemberId}
        currentMemberRole={data.currentMemberRole}
      />
    </div>
  );
}
