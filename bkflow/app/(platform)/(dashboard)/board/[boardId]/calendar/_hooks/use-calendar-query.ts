"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { projectCalendarEntries, projectChecklistEntries } from "@/lib/calendar/calendar-entries";
import { getCalendarRange, getTodayKey } from "@/lib/calendar/calendar-navigation";
import { buildDayTimeline } from "@/lib/calendar/day-timeline";
import { toCalendarDisplayItems } from "@/lib/calendar/schedule-adapter";
import { fetcher } from "@/lib/fetcher";
import {
  boardFiltersAreActive,
  calendarItemMatchesBoardFilters,
  unscheduledCardMatchesBoardFilters,
} from "@/lib/boards/board-filters";
import type { BoardFilterState } from "@/hooks/use-board-filters";
import type {
  BoardCalendarCardItem,
  BoardCalendarChecklistItem,
  BoardCalendarResponse,
} from "@/types";

import {
  MAX_DAY_LANES,
  MAX_MOBILE_DAY_LANES,
} from "../_lib/constants";
import {
  getDayGridRange,
  getDayKey,
  getGmt7DayKey,
  getMonthGridRange,
  getWeekGridRange,
} from "../_lib/date-utils";
import {
  getDayViewBlocks,
  getOverlappingDayBlockLayout,
} from "../_lib/day-view-layout";
import {
  getOccurrences,
  getRanges,
  getRangeOccurrencesByDay,
  getRangeSegmentsForWeeks,
  getWeekRows,
} from "../_lib/range-layout";
import type {
  CalendarOccurrence,
  DayViewBlock,
  ViewMode,
} from "../_types";

type UseCalendarQueryOptions = {
  boardId: string;
  viewMode: ViewMode;
  anchorDate: Date;
  filters: BoardFilterState;
  currentBoardMemberId: string;
};

export const useCalendarQuery = ({
  boardId,
  viewMode,
  anchorDate,
  filters,
  currentBoardMemberId,
}: UseCalendarQueryOptions) => {
  // Range theo ngày VN, `toIso` là biên mở; `days` chỉ để dựng lưới.
  const { fromIso, toIso, days } = useMemo(
    () => {
      const grid = viewMode === "month"
        ? getMonthGridRange(anchorDate)
        : viewMode === "week"
          ? getWeekGridRange(anchorDate)
          : getDayGridRange(anchorDate);
      const range = getCalendarRange(getTodayKey(anchorDate), viewMode);

      return { fromIso: range.from, toIso: range.to, days: grid.days };
    },
    [anchorDate, viewMode],
  );

  const query = useQuery<BoardCalendarResponse>({
    queryKey: ["board-calendar", boardId, viewMode, fromIso, toIso],
    queryFn: () =>
      fetcher(
        `/api/boards/${boardId}/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&includeUnscheduled=true`,
      ),
  });

  const responseItems = query.data?.items;
  const unfilteredItems = useMemo(
    () => (responseItems ?? []).flatMap(toCalendarDisplayItems),
    [responseItems],
  );
  const unscheduledCards = useMemo(
    () => query.data?.unscheduledCards ?? [],
    [query.data?.unscheduledCards],
  );
  const filtersAreActive = useMemo(() => boardFiltersAreActive(filters), [filters]);
  const items = useMemo(
    () => unfilteredItems.filter((item) =>
      calendarItemMatchesBoardFilters(item, filters, currentBoardMemberId),
    ),
    [currentBoardMemberId, filters, unfilteredItems],
  );
  const filteredUnscheduledCards = useMemo(() => {
    return unscheduledCards.filter((card) =>
      unscheduledCardMatchesBoardFilters(card, filters, currentBoardMemberId),
    );
  }, [currentBoardMemberId, filters, unscheduledCards]);
  const occurrences = useMemo(() => getOccurrences(items), [items]);
  const ranges = useMemo(() => getRanges(items), [items]);
  const dayViewBlocks = useMemo(
    () => getDayViewBlocks(items, anchorDate),
    [anchorDate, items],
  );
  const dayViewBlocksById = useMemo(() => {
    return dayViewBlocks.reduce<Record<string, DayViewBlock>>((acc, block) => {
      acc[block.id] = block;

      return acc;
    }, {});
  }, [dayViewBlocks]);
  const desktopDayViewLayout = useMemo(
    () => getOverlappingDayBlockLayout(dayViewBlocks, MAX_DAY_LANES),
    [dayViewBlocks],
  );
  const mobileDayViewLayout = useMemo(
    () => getOverlappingDayBlockLayout(dayViewBlocks, MAX_MOBILE_DAY_LANES),
    [dayViewBlocks],
  );
  // Timeline ngày dựng từ entry gốc của các thẻ còn hiện sau khi lọc; hạn nộp không chiếm thời gian.
  const { dayTimeline, dayCardMeta } = useMemo(() => {
    const visibleCardIds = new Set(items.map((item) => item.cardId));
    const visibleIds = new Set(items.map((item) => item.id));
    const raw = responseItems ?? [];
    const cards = raw.filter(
      (item): item is BoardCalendarCardItem => item.type === "card" && visibleCardIds.has(item.cardId),
    );
    const checklists = raw.filter(
      (item): item is BoardCalendarChecklistItem => item.type === "checklist-item" && visibleIds.has(item.id),
    );
    const entries = [...projectCalendarEntries(cards), ...projectChecklistEntries(checklists)];

    return {
      dayTimeline: buildDayTimeline(entries, getGmt7DayKey(anchorDate)),
      dayCardMeta: Object.fromEntries(
        cards.map((card) => [card.cardId, { title: card.title, isCompleted: card.isCompleted }]),
      ) as Record<string, { title: string; isCompleted: boolean }>,
    };
  }, [anchorDate, items, responseItems]);
  const weekRows = useMemo(() => getWeekRows(days), [days]);
  const daysByKey = useMemo(() => {
    return days.reduce<Record<string, Date>>((acc, day) => {
      acc[getDayKey(day)] = day;

      return acc;
    }, {});
  }, [days]);
  const rangeSegmentsByWeek = useMemo(
    () => getRangeSegmentsForWeeks(ranges, weekRows),
    [ranges, weekRows],
  );
  const rangeOccurrencesByDay = useMemo(
    () => getRangeOccurrencesByDay(ranges, days),
    [ranges, days],
  );
  const occurrencesById = useMemo(() => {
    return occurrences.reduce<Record<string, CalendarOccurrence>>((acc, occurrence) => {
      acc[occurrence.id] = occurrence;

      return acc;
    }, {});
  }, [occurrences]);
  const occurrencesByDay = useMemo(() => {
    return occurrences.reduce<Record<string, CalendarOccurrence[]>>((acc, occurrence) => {
      const key = getDayKey(occurrence.date);
      acc[key] = [...(acc[key] ?? []), occurrence].sort((left, right) => {
        const timeDelta = left.date.getTime() - right.date.getTime();

        if (timeDelta !== 0) {
          return timeDelta;
        }

        if (left.item.isCompleted !== right.item.isCompleted) {
          return left.item.isCompleted ? 1 : -1;
        }

        return left.item.title.localeCompare(right.item.title, "vi");
      });

      return acc;
    }, {});
  }, [occurrences]);

  return {
    fromIso,
    toIso,
    days,
    query,
    responseItems,
    unfilteredItems,
    unscheduledCards,
    filtersAreActive,
    items,
    filteredUnscheduledCards,
    occurrences,
    ranges,
    dayViewBlocks,
    dayTimeline,
    dayCardMeta,
    dayViewBlocksById,
    desktopDayViewLayout,
    mobileDayViewLayout,
    weekRows,
    daysByKey,
    rangeSegmentsByWeek,
    rangeOccurrencesByDay,
    occurrencesById,
    occurrencesByDay,
  };
};
