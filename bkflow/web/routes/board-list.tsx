import { Suspense } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";

import type { loadBoardList } from "@/server/views/board-list";
import { BoardListView } from "@/app/(platform)/(dashboard)/board/[boardId]/list/_components/board-list-view";
import { Skeleton } from "@/components/ui/skeleton";

import { boardListViewPath } from "../lib/prefetch-route";
import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardList>>;

export default function BoardListRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const searchParams = useSearchParams()[0];
  const error = searchParams.get("error") ?? undefined;
  const group = searchParams.get("group");
  const { data } = useView<View>(boardListViewPath(boardId ?? "", group));

  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <Suspense>
      <BoardListView
        boardId={data.boardId}
        boardOrgId={data.boardOrgId}
        isTeamBoard={data.isTeamBoard}
        canEdit={data.canEdit}
        currentBoardMemberId={data.currentBoardMemberId}
        assignableMembers={data.assignableMembers}
        lists={data.lists}
        members={data.members}
        labels={data.labels}
        showCourseFilter={data.showCourseFilter}
        initialData={data.initialData}
        initialAgendaData={data.initialAgendaData}
        error={error}
      />
    </Suspense>
  );
}
