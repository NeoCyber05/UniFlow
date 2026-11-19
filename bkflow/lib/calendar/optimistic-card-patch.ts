import type { QueryClient } from "@tanstack/react-query";

import type { BoardCalendarCardItem, BoardCalendarResponse, BoardCalendarUnscheduledCard } from "@/types";

import { calendarRangeQueryKey, calendarUnscheduledQueryKey } from "./calendar-query-keys";

/** Áp patch lên cache lịch; thẻ ở khay "chưa xếp" vừa được xếp lịch thì chuyển ngay sang lưới, không chờ refetch. */
export const applyCardPatchToCalendar = (
  current: BoardCalendarResponse,
  cardId: string,
  patch: Partial<BoardCalendarCardItem>,
  trayCard?: BoardCalendarUnscheduledCard,
): BoardCalendarResponse => {
  const tray = patch.scheduledOn || patch.scheduledStartAt ? trayCard : undefined;
  const items = current.items.map((item) =>
    item.type === "card" && item.cardId === cardId ? { ...item, ...patch } : item
  );

  // Thẻ có hạn trong khoảng xem đã nằm sẵn trong items; chỉ thêm khi chưa có.
  if (tray && !current.items.some((item) => item.type === "card" && item.cardId === cardId)) {
    items.push({
      ...tray,
      type: "card",
      id: `card:${cardId}`,
      startDate: null,
      dueDate: tray.dueDate ?? null,
      deadlineOn: tray.deadlineOn ?? null,
      scheduledOn: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      reminder: null,
      ...patch,
    });
  }

  return { ...current, items };
};

export const applyCalendarPatchToCache = (
  queryClient: QueryClient,
  boardId: string,
  cardId: string,
  patch: Partial<BoardCalendarCardItem>,
) => {
  const trayKey = calendarUnscheduledQueryKey(boardId);
  const trayCard = queryClient.getQueryData<BoardCalendarUnscheduledCard[]>(trayKey)
    ?.find((card) => card.cardId === cardId);

  queryClient.setQueriesData<BoardCalendarResponse>(
    { queryKey: calendarRangeQueryKey(boardId) },
    (current) => current && applyCardPatchToCalendar(current, cardId, patch, trayCard),
  );

  if (trayCard) {
    queryClient.setQueryData<BoardCalendarUnscheduledCard[]>(trayKey, (current) =>
      patch.scheduledOn || patch.scheduledStartAt
        ? current?.filter((card) => card.cardId !== cardId)
        : current?.map((card) => card.cardId === cardId ? {
          ...card,
          ...(patch.updatedAt !== undefined ? { updatedAt: patch.updatedAt } : {}),
          ...(patch.isCompleted !== undefined ? { isCompleted: patch.isCompleted } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.deadlineOn !== undefined ? { deadlineOn: patch.deadlineOn } : {}),
        } : card),
    );
  }
};
