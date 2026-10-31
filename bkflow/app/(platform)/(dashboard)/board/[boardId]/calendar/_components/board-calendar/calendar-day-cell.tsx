"use client";

import { memo, type DragEvent, type MouseEvent } from "react";
import { Plus } from "lucide-react";

import { Hint } from "@/components/hint";
import { tr, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { CalendarOccurrenceItem } from "./calendar-occurrence";
import {
  getWeekDays,
  MONTH_RANGE_LANES,
  RANGE_LANE_GAP,
  RANGE_LANE_HEIGHT,
  WEEK_RANGE_LANES,
} from "../../_lib/constants";
import {
  formatCalendarDate,
  formatCalendarDayMonth,
  getDayKey,
  getGmt7Parts,
  isCalendarToday,
  isSameCalendarMonth,
} from "../../_lib/date-utils";
import type {
  CalendarMarkerListStyle,
  CalendarOccurrence,
  CalendarRangeSegment,
  CalendarResizeState,
  ViewMode,
} from "../../_types";

type CalendarDayCellProps = {
  day: Date;
  index: number;
  /** Chiều cao hàng tuần đã co giãn (px), nếu có. */
  rowHeight?: number;
  viewMode: ViewMode;
  variant: "default" | "split";
  currentMonth: Date;
  maxVisibleDesktop: number;
  maxVisibleMobile: number;
  listsCount: number;
  isCreatingCard: boolean;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  draggingOccurrenceId: string | null;
  draggingUnscheduledCardId: string | null;
  draggingBoardCardId: string | null;
  draggingDayViewBlockId: string | null;
  dragOverDayKey: string | null;
  resizingRange: CalendarResizeState | null;
  occurrencesByDay: Record<string, CalendarOccurrence[]>;
  rangeOccurrencesByDay: Record<string, CalendarOccurrence[]>;
  rangeSegmentsByWeek: Record<number, CalendarRangeSegment[]>;
  canPlanSchedule: (occurrence: CalendarOccurrence) => boolean;
  canClearSchedule: (occurrence: CalendarOccurrence) => boolean;
  onOpenCard: (
    cardId: string,
    event?: MouseEvent<HTMLElement>,
    options?: { checklistItemId?: string },
  ) => void;
  onOpenCardDirect: (
    cardId: string,
    options?: { checklistItemId?: string },
  ) => void;
  onOccurrenceDragStart: (
    event: DragEvent<HTMLDivElement>,
    occurrence: CalendarOccurrence,
  ) => void;
  onOccurrenceDragEnd: () => void;
  onQuickActionClick: (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => void;
  onToggleComplete: (occurrence: CalendarOccurrence) => void;
  onPlanSchedule: (occurrence: CalendarOccurrence) => void;
  onClearSchedule: (occurrence: CalendarOccurrence) => void;
  onOpenCreateDialog: (day: Date, event: MouseEvent<HTMLButtonElement>) => void;
  onSetExpandedDayKey: (dayKey: string) => void;
  onDayDragOver: (event: DragEvent<HTMLDivElement>, dayKey: string) => void;
  onDayDrop: (event: DragEvent<HTMLDivElement>, day: Date) => void;
  onDayDragLeave: (dayKey: string) => void;
};

export const CalendarDayCell = memo(function CalendarDayCell({
  day,
  index,
  rowHeight,
  viewMode,
  variant,
  currentMonth,
  maxVisibleDesktop,
  maxVisibleMobile,
  listsCount,
  isCreatingCard,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  draggingOccurrenceId,
  draggingUnscheduledCardId,
  draggingBoardCardId,
  draggingDayViewBlockId,
  dragOverDayKey,
  resizingRange,
  occurrencesByDay,
  rangeOccurrencesByDay,
  rangeSegmentsByWeek,
  canPlanSchedule,
  canClearSchedule,
  onOpenCard,
  onOpenCardDirect,
  onOccurrenceDragStart,
  onOccurrenceDragEnd,
  onQuickActionClick,
  onToggleComplete,
  onPlanSchedule,
  onClearSchedule,
  onOpenCreateDialog,
  onSetExpandedDayKey,
  onDayDragOver,
  onDayDrop,
  onDayDragLeave,
}: CalendarDayCellProps) {
  useLocale((s) => s.locale);
  const dayKey = getDayKey(day);
  const dayOccurrences = occurrencesByDay[dayKey] ?? [];
  const dayRangeOccurrences = rangeOccurrencesByDay[dayKey] ?? [];
  const mobileOverflow = Math.max(dayOccurrences.length - maxVisibleMobile, 0);

  const dayIndex = index % 7;
  const weekIndex = Math.floor(index / 7);
  const weekSegments = rangeSegmentsByWeek[weekIndex] ?? [];
  const maxLanes = viewMode === "month" ? MONTH_RANGE_LANES : WEEK_RANGE_LANES;

  const activeSegments = weekSegments.filter(
    (s) => s.startIndex <= dayIndex && s.endIndex >= dayIndex
  );
  const hasRangeOverflow = activeSegments.some((s) => s.lane >= maxLanes);
  const maxVisibleLane = activeSegments
    .filter((s) => s.lane < maxLanes)
    .reduce((max, s) => Math.max(max, s.lane), -1);

  let pt = 0;
  if (hasRangeOverflow) {
    pt = 36 + maxLanes * (RANGE_LANE_HEIGHT + RANGE_LANE_GAP);
  } else if (maxVisibleLane >= 0) {
    pt = 36 + (maxVisibleLane + 1) * (RANGE_LANE_HEIGHT + RANGE_LANE_GAP);
  }

  // Hàng đã co giãn: số thẻ vừa chiều cao (đệm 16 + đầu ô 32 + nút "+N" 28, mỗi thẻ 28 + khoảng 4).
  const visibleDesktop = rowHeight
    ? Math.max(1, Math.floor((rowHeight - 76 - pt) / 32))
    : maxVisibleDesktop;
  const desktopOverflow = Math.max(dayOccurrences.length - visibleDesktop, 0);

  const markerListStyle: CalendarMarkerListStyle | undefined = pt > 0
    ? viewMode === "month"
      ? { paddingTop: `${pt}px` }
      : { "--pt-desktop": `${pt}px` }
    : undefined;

  const formattedDate = formatCalendarDate(day);
  const addCardLabel = listsCount === 0
    ? tr("calendar.cell.createListFirst")
    : tr("calendar.cell.addCardOnDate", { date: formattedDate });

  return (
    <div
      key={dayKey}
      data-calendar-day-key={dayKey}
      onDragOver={(event) => onDayDragOver(event, dayKey)}
      onDragEnter={(event) => onDayDragOver(event, dayKey)}
      onDragLeave={() => onDayDragLeave(dayKey)}
      onDrop={(event) => onDayDrop(event, day)}
      className={cn(
        "group/day overflow-hidden border-neutral-200 bg-white p-1.5 transition-colors md:p-2",
        viewMode === "month" && "min-h-[104px] border-r border-b sm:min-h-[132px]",
        viewMode === "month" && index % 7 === 6 && "border-r-0",
        viewMode === "week" && "min-h-[132px] rounded-lg border md:min-h-[360px]",
        viewMode === "week" && index > 0 && "mt-2 md:mt-0",
        rowHeight && "md:min-h-0",
        viewMode === "month" && index % 7 >= 5 && "bg-neutral-50/50",
        viewMode === "month" && !isSameCalendarMonth(day, currentMonth) && "bg-neutral-50/80 text-neutral-400",
        isCalendarToday(day) && "bg-violet-50/40 ring-1 ring-inset ring-violet-300",
        (draggingOccurrenceId || draggingUnscheduledCardId || draggingBoardCardId || draggingDayViewBlockId) && "ring-inset ring-violet-100",
        resizingRange && "cursor-ew-resize ring-inset ring-violet-100",
        dragOverDayKey === dayKey && "bg-violet-50 ring-2 ring-inset ring-violet-300",
      )}
    >
      <div className="mb-1 flex h-7 items-center justify-between gap-x-2">
        <div className="flex min-w-0 items-center gap-x-1.5">
          {viewMode === "week" && (
            <span className="truncate text-[11px] font-semibold uppercase text-neutral-500">
              {getWeekDays()[index]}
            </span>
          )}
          <span
            className={cn(
              "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-neutral-600",
              viewMode === "month" && !isSameCalendarMonth(day, currentMonth) && "text-neutral-400",
              isCalendarToday(day) && "bg-violet-600 text-white",
            )}
          >
            {viewMode === "week" ? formatCalendarDayMonth(day) : getGmt7Parts(day).date}
          </span>
        </div>
        <Hint description={addCardLabel} side="top">
          <button
            type="button"
            onClick={(event) => onOpenCreateDialog(day, event)}
            disabled={
              !!resizingRange ||
              listsCount === 0 ||
              isCreatingCard ||
              isUpdatingCardDate ||
              isUpdatingChecklistItemDueDate
            }
            aria-label={addCardLabel}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-100 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:bg-violet-50 focus-visible:text-violet-700 disabled:cursor-not-allowed disabled:opacity-30 md:opacity-0 md:group-hover/day:opacity-100 md:focus-visible:opacity-100",
              isCalendarToday(day) && "text-violet-700",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </Hint>
      </div>

      <div
        style={markerListStyle}
        className={cn(
          "space-y-1",
          viewMode === "week" && pt > 0 && "md:[padding-top:var(--pt-desktop)]",
        )}
      >
        {viewMode === "week" && dayRangeOccurrences.map((occurrence) =>
          <CalendarOccurrenceItem
            key={occurrence.id}
            occurrence={occurrence}
            variant={variant}
            className="md:hidden"
            draggingOccurrenceId={draggingOccurrenceId}
            isUpdatingCardDate={isUpdatingCardDate}
            isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
            canPlanSchedule={canPlanSchedule}
            canClearSchedule={canClearSchedule}
            onOpenCard={onOpenCard}
            onOpenCardDirect={onOpenCardDirect}
            onDragStart={onOccurrenceDragStart}
            onDragEnd={onOccurrenceDragEnd}
            onQuickActionClick={onQuickActionClick}
            onToggleComplete={onToggleComplete}
            onPlanSchedule={onPlanSchedule}
            onClearSchedule={onClearSchedule}
          />,
        )}
        {dayOccurrences.slice(0, visibleDesktop).map((occurrence, occurrenceIndex) =>
          <CalendarOccurrenceItem
            key={occurrence.id}
            occurrence={occurrence}
            variant={variant}
            className={occurrenceIndex >= maxVisibleMobile ? "hidden sm:flex" : undefined}
            draggingOccurrenceId={draggingOccurrenceId}
            isUpdatingCardDate={isUpdatingCardDate}
            isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
            canPlanSchedule={canPlanSchedule}
            canClearSchedule={canClearSchedule}
            onOpenCard={onOpenCard}
            onOpenCardDirect={onOpenCardDirect}
            onDragStart={onOccurrenceDragStart}
            onDragEnd={onOccurrenceDragEnd}
            onQuickActionClick={onQuickActionClick}
            onToggleComplete={onToggleComplete}
            onPlanSchedule={onPlanSchedule}
            onClearSchedule={onClearSchedule}
          />,
        )}
        {mobileOverflow > 0 && (
          <button
            type="button"
            onClick={() => onSetExpandedDayKey(dayKey)}
            aria-label={tr("calendar.cell.showMoreCardsAria", { count: mobileOverflow, date: formattedDate })}
            className="flex h-6 w-full items-center rounded-md px-1.5 text-left text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 sm:hidden"
          >
            {tr("calendar.cell.moreCards", { count: mobileOverflow })}
          </button>
        )}
        {desktopOverflow > 0 && (
          <button
            type="button"
            onClick={() => onSetExpandedDayKey(dayKey)}
            aria-label={tr("calendar.cell.showMoreCardsAria", { count: desktopOverflow, date: formattedDate })}
            className="hidden h-6 w-full items-center rounded-md px-1.5 text-left text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 sm:flex"
          >
            {tr("calendar.cell.moreCards", { count: desktopOverflow })}
          </button>
        )}
      </div>
    </div>
  );
}, areCalendarDayCellPropsEqual);

function areCalendarDayCellPropsEqual(
  prev: CalendarDayCellProps,
  next: CalendarDayCellProps,
): boolean {
  if (prev.day.getTime() !== next.day.getTime()) return false;
  if (prev.index !== next.index) return false;
  if (prev.rowHeight !== next.rowHeight) return false;
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.variant !== next.variant) return false;
  if (prev.currentMonth.getTime() !== next.currentMonth.getTime()) return false;
  if (prev.maxVisibleDesktop !== next.maxVisibleDesktop) return false;
  if (prev.maxVisibleMobile !== next.maxVisibleMobile) return false;
  if (prev.listsCount !== next.listsCount) return false;
  if (prev.isCreatingCard !== next.isCreatingCard) return false;
  if (prev.isUpdatingCardDate !== next.isUpdatingCardDate) return false;
  if (prev.isUpdatingChecklistItemDueDate !== next.isUpdatingChecklistItemDueDate) return false;

  const dayKey = getDayKey(next.day);

  // Chỉ re-render ô này nếu trạng thái dragOver của chính ô này thay đổi
  const prevIsDragOver = prev.dragOverDayKey === dayKey;
  const nextIsDragOver = next.dragOverDayKey === dayKey;
  if (prevIsDragOver !== nextIsDragOver) return false;

  // Việc đang kéo chung làm thay đổi border/ring của tất cả ô
  const prevAnyDrag = Boolean(
    prev.draggingOccurrenceId ||
    prev.draggingUnscheduledCardId ||
    prev.draggingBoardCardId ||
    prev.draggingDayViewBlockId,
  );
  const nextAnyDrag = Boolean(
    next.draggingOccurrenceId ||
    next.draggingUnscheduledCardId ||
    next.draggingBoardCardId ||
    next.draggingDayViewBlockId,
  );
  if (prevAnyDrag !== nextAnyDrag) return false;

  // Nếu draggingOccurrenceId cụ thể thay đổi, chỉ re-render ô nào chứa item đó
  if (prev.draggingOccurrenceId !== next.draggingOccurrenceId) {
    const prevItems = prev.occurrencesByDay[dayKey] ?? [];
    const hasDraggedItem = prevItems.some(
      (o) => o.id === prev.draggingOccurrenceId || o.id === next.draggingOccurrenceId,
    );
    if (hasDraggedItem) return false;
  }

  // Trạng thái resize dải ngày
  if (Boolean(prev.resizingRange) !== Boolean(next.resizingRange)) return false;

  // Sự kiện trong ngày
  if (prev.occurrencesByDay[dayKey] !== next.occurrencesByDay[dayKey]) return false;
  if (prev.rangeOccurrencesByDay[dayKey] !== next.rangeOccurrencesByDay[dayKey]) return false;

  // Các dải ngày của hàng tuần này
  const weekIndex = Math.floor(next.index / 7);
  if (prev.rangeSegmentsByWeek[weekIndex] !== next.rangeSegmentsByWeek[weekIndex]) return false;

  return true;
}

CalendarDayCell.displayName = "CalendarDayCell";
