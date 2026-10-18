import { Navigate, useParams } from "react-router";

import type { loadBoardCalendar } from "@/server/views/board-calendar";
import { BoardCalendarView } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_components/board-calendar-view";
import { Skeleton } from "@/components/ui/skeleton";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardCalendar>>;

export default function BoardCalendarRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}/calendar`);

  if (!data) return <Skeleton className="m-4 h-64" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="h-full p-4">
      <BoardCalendarView
        boardId={data.boardId}
        lists={data.lists}
        currentUserId={data.currentUserId}
        currentBoardMemberId={data.currentBoardMemberId}
      />
    </div>
  );
}
