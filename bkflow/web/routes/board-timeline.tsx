import { Navigate, useParams } from "react-router";

import type { loadBoardTimeline } from "@/server/views/board-timeline";
import { BoardCardModalFromUrl } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-card-modal-from-url";
import { BoardTimelineView } from "@/app/(platform)/(dashboard)/board/[boardId]/timeline/_components/board-timeline-view";
import { ViewSkeleton } from "@/components/view-skeleton";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardTimeline>>;

export default function BoardTimelineRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}/timeline`);

  if (!data) return <ViewSkeleton variant="rows" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="h-full p-4">
      <BoardCardModalFromUrl />
      <BoardTimelineView
        boardId={data.boardId}
        boardTitle={data.boardTitle}
        lists={data.lists}
        boardMembers={data.boardMembers}
        currentUserId={data.currentUserId}
        currentBoardMemberId={data.currentBoardMemberId}
        currentMemberRole={data.currentMemberRole}
      />
    </div>
  );
}
