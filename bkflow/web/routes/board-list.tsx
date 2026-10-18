import { Suspense } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";

import type { loadBoardList } from "@/server/views/board-list";
import { BoardListView } from "@/app/(platform)/(dashboard)/board/[boardId]/list/_components/board-list-view";
import { Skeleton } from "@/components/ui/skeleton";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardList>>;

export default function BoardListRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const error = useSearchParams()[0].get("error") ?? undefined;
  const { data } = useView<View>(`/board/${boardId}/list`);

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
        initialData={data.initialData}
        initialAgendaData={data.initialAgendaData}
        error={error}
      />
    </Suspense>
  );
}
