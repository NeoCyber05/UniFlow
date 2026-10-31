import { useEffect } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import type { loadBoardCalendar } from "@/server/views/board-calendar";
import { BoardCalendarView } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_components/board-calendar-view";
import { ViewSkeleton } from "@/components/view-skeleton";
import { CalendarErrorState } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_components/calendar-error-state";
import { getBoardCalendarQueryOptions } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_hooks/use-calendar-query";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardCalendar>>;

export default function BoardCalendarRoute() {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (boardId) {
      void queryClient.prefetchQuery(getBoardCalendarQueryOptions(boardId, { searchParams }));
    }
  }, [boardId, searchParams, queryClient]);

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
  if (!data) return <ViewSkeleton variant="grid" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="h-full p-4">
      <BoardCalendarView
        boardId={data.boardId}
        lists={data.lists}
        currentUserId={data.currentUserId}
        currentBoardMemberId={data.currentBoardMemberId}
        initialData={data.initialCalendarData}
      />
    </div>
  );
}
