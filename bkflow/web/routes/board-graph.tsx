import { Navigate, useParams } from "react-router";

import type { loadBoardGraph } from "@/server/views/board-graph";
import { BoardCardModalFromUrl } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-card-modal-from-url";
import { BoardGraphView } from "@/app/(platform)/(dashboard)/board/[boardId]/graph/_components/board-graph-view";
import { Skeleton } from "@/components/ui/skeleton";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardGraph>>;

export default function BoardGraphRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}/graph`);

  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="h-full p-4">
      <BoardCardModalFromUrl />
      <BoardGraphView
        boardId={data.boardId}
        boardTitle={data.boardTitle}
        initialPlan={data.plan}
        lists={data.lists}
        boardMembers={data.boardMembers}
        currentUserId={data.currentUserId}
        currentBoardMemberId={data.currentBoardMemberId}
        currentMemberRole={data.currentMemberRole}
      />
    </div>
  );
}
