"use client";

import type { BoardCalendarItem } from "@/types";
import type { ComponentProps } from "react";

import { CalendarWeekRow } from "./board-calendar/calendar-week-row";

type CalendarWeekRowProps = ComponentProps<typeof CalendarWeekRow>;

type CalendarWeekViewProps = {
  days: Date[];
  items: BoardCalendarItem[];
  weekRows: Date[][];
  rowProps: Omit<
    CalendarWeekRowProps,
    "weekDays" | "weekIndex" | "mode" | "weekRowsLength"
  >;
};

export const CalendarWeekView = ({
  days,
  items,
  weekRows,
  rowProps,
}: CalendarWeekViewProps) => {
  const timed = new Set(items.filter((item) => item.type === "card" && item.displayKind === "work" && item.scheduledStartAt && item.scheduledEndAt).map((item) => item.id));
  const withoutTimed = <T extends { item: BoardCalendarItem }>(rows: Record<string, T[]>) => Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values.filter((value) => !timed.has(value.item.id))]));
  return (
  <div className="min-w-[700px]">
  <CalendarWeekRow
    weekDays={weekRows[0] ?? days}
    weekIndex={0}
    mode="week"
    weekRowsLength={weekRows.length}
    {...rowProps}
    occurrencesByDay={withoutTimed(rowProps.occurrencesByDay)}
    rangeOccurrencesByDay={withoutTimed(rowProps.rangeOccurrencesByDay)}
    rangeSegmentsByWeek={Object.fromEntries(Object.entries(rowProps.rangeSegmentsByWeek).map(([key, values]) => [key, values.filter((value) => !timed.has(value.range.item.id))]))}
  />
  </div>
);
};
