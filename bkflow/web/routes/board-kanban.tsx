import { Navigate, useParams } from "react-router";

import type { loadBoardKanban } from "@/server/views/board-kanban";
import { BoardCardModalFromUrl } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-card-modal-from-url";
import { ListContainer } from "@/app/(platform)/(dashboard)/board/[boardId]/kanban/_components/list-container";
import { Skeleton } from "@/components/ui/skeleton";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardKanban>>;

export default function BoardKanbanRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}`);

  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="p-4 h-full overflow-x-auto">
      <BoardCardModalFromUrl />
      <ListContainer
        boardId={data.boardId}
        data={data.lists}
        boardMembers={data.boardMembers}
        currentUserId={data.currentUserId}
        currentMemberRole={data.currentMemberRole}
      />
    </div>
  );
}
