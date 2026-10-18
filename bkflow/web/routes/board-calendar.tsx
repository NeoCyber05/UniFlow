import { Navigate, useParams } from "react-router";

import type { loadBoardCalendar } from "@/server/views/board-calendar";
import { BoardCalendarView } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_components/board-calendar-view";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarErrorState } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_components/calendar-error-state";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardCalendar>>;

export default function BoardCalendarRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data, isError, refetch } = useView<View>(`/board/${boardId}/calendar`);

  // Lỗi (kể cả 403/404) hiển thị lỗi, không để skeleton vô hạn và không giả thành lịch trống.
  if (isError) {
    return (
      <div className="h-full p-4">
        <CalendarErrorState />
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
      <BoardCalendarView
        boardId={data.boardId}
        lists={data.lists}
        currentUserId={data.currentUserId}
        currentBoardMemberId={data.currentBoardMemberId}
      />
    </div>
  );
}
