import { Navigate, useParams } from "react-router";

import type { loadBoardSplit } from "@/server/views/board-split";
import { BoardCalendarView } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_components/board-calendar-view";
import { ListContainer } from "@/app/(platform)/(dashboard)/board/[boardId]/kanban/_components/list-container";
import { SplitPane } from "@/app/(platform)/(dashboard)/board/[boardId]/split/_components/split-pane";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskLayoutSwitcher } from "@/components/my-tasks/task-layout-switcher";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardSplit>>;

export default function BoardSplitRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}/split`);

  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-end px-3 pt-3 md:px-4 md:pt-4">
        <TaskLayoutSwitcher boardId={data.boardId} layout="split" />
      </header>
      <div className="min-h-0 flex-1">
        <SplitPane
          calendarNode={
            <BoardCalendarView
              boardId={data.boardId}
              lists={data.calendarLists}
              currentUserId={data.currentUserId}
              currentBoardMemberId={data.currentBoardMemberId}
              defaultUnscheduledCollapsed
              variant="split"
            />
          }
          boardNode={
            <ListContainer
              boardId={data.boardId}
              data={data.lists}
              boardMembers={data.boardMembers}
              currentUserId={data.currentUserId}
              currentMemberRole={data.currentMemberRole}
              enableCalendarDragHandle
            />
          }
        />
      </div>
    </div>
  );
}
