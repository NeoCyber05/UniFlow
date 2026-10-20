import { Navigate, useParams } from "react-router";
import { ListTodo } from "lucide-react";

import type { loadBoardKanban } from "@/server/views/board-kanban";
import { BoardCardModalFromUrl } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-card-modal-from-url";
import { ListContainer } from "@/app/(platform)/(dashboard)/board/[boardId]/kanban/_components/list-container";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskLayoutSwitcher } from "@/components/my-tasks/task-layout-switcher";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardKanban>>;

export default function BoardKanbanRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}`);

  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <BoardCardModalFromUrl />
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl glass-surface px-5 py-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-900">
          <ListTodo aria-hidden="true" className="h-6 w-6 text-violet-600" />
          Việc cần làm
        </h1>
        <TaskLayoutSwitcher boardId={data.boardId} layout="columns" />
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <ListContainer
          boardId={data.boardId}
          data={data.lists}
          boardMembers={data.boardMembers}
          currentUserId={data.currentUserId}
          currentMemberRole={data.currentMemberRole}
        />
      </div>
    </div>
  );
}
