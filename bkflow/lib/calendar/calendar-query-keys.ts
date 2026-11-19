export const calendarRangeQueryKey = (boardId: string) =>
  ["board-calendar", boardId, "range"] as const;

export const calendarUnscheduledQueryKey = (boardId: string) =>
  ["board-calendar", boardId, "unscheduled"] as const;
