import type { BoardCalendarCardItem, BoardCalendarResponse } from "@/types";

/** Áp patch lên cache lịch; thẻ ở khay "chưa xếp" vừa được xếp lịch thì chuyển ngay sang lưới, không chờ refetch. */
export const applyCardPatchToCalendar = (
  current: BoardCalendarResponse,
  cardId: string,
  patch: Partial<BoardCalendarCardItem>,
): BoardCalendarResponse => {
  const tray = patch.scheduledOn || patch.scheduledStartAt
    ? current.unscheduledCards.find((card) => card.cardId === cardId)
    : undefined;
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

  return {
    ...current,
    items,
    unscheduledCards: tray
      ? current.unscheduledCards.filter((card) => card.cardId !== cardId)
      : current.unscheduledCards,
  };
};
