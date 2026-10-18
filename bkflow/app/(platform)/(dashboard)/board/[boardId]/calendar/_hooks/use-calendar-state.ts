"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { readCalendarLocation, writeCalendarLocation, shiftCalendarDay, getTodayKey } from "@/lib/calendar/calendar-navigation";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";

import type { BoardCalendarList, ViewMode } from "../_types";

type UseCalendarStateOptions = {
  boardId: string;
  defaultUnscheduledCollapsed: boolean;
  lists: BoardCalendarList[];
};

export const useCalendarState = ({
  boardId,
  defaultUnscheduledCollapsed,
  lists,
}: UseCalendarStateOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useMemo(() => readCalendarLocation(searchParams), [searchParams]);
  const viewMode = location.mode;
  const anchorDate = useMemo(() => new Date(`${location.day}T12:00:00+07:00`), [location.day]);
  const filters = useBoardFilters((state) => state.filtersByBoardId[boardId] ?? emptyBoardFilters);
  const setFilters = useBoardFilters((state) => state.setFilters);
  const lastLocation = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = searchParams.toString();
    if (lastLocation.current !== key) {
      lastLocation.current = key;
      if (location.filters && JSON.stringify(location.filters) !== JSON.stringify(filters)) {
        setFilters(boardId, location.filters);
        return;
      }
    }
    const next = writeCalendarLocation(searchParams, { ...location, filters });
    if (next.toString() !== key) {
      lastLocation.current = next.toString();
      setSearchParams(next, { replace: true });
    }
  }, [boardId, filters, location, searchParams, setFilters, setSearchParams]);
  const select = (day: string, mode: ViewMode = viewMode) => {
    setExpandedDayKey(null);
    setSearchParams((current) => writeCalendarLocation(current, { day, mode, filters }));
  };
  const setAnchorDate = (date: Date) => select(getTodayKey(date));
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [openDayOverflowGroupId, setOpenDayOverflowGroupId] = useState<string | null>(null);
  const [createDialogDay, setCreateDialogDay] = useState<Date | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createStartValue, setCreateStartValue] = useState("");
  const [createDueValue, setCreateDueValue] = useState("");
  const [createListId, setCreateListId] = useState(() => lists[0]?.id ?? "");
  const [isUnscheduledCollapsed, setIsUnscheduledCollapsed] = useState(
    defaultUnscheduledCollapsed,
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const goToPrevious = () => select(shiftCalendarDay(location.day, viewMode, -1));
  const goToNext = () => select(shiftCalendarDay(location.day, viewMode, 1));
  const goToToday = () => select(getTodayKey());
  const changeViewMode = (mode: ViewMode) => select(location.day, mode);

  const resetCreateDialog = useCallback(() => {
    setCreateDialogDay(null);
    setCreateTitle("");
    setCreateStartValue("");
    setCreateDueValue("");
  }, []);

  return {
    viewMode,
    setViewMode: changeViewMode,
    anchorDate,
    setAnchorDate,
    currentTime,
    setCurrentTime,
    expandedDayKey,
    setExpandedDayKey,
    openDayOverflowGroupId,
    setOpenDayOverflowGroupId,
    createDialogDay,
    setCreateDialogDay,
    createTitle,
    setCreateTitle,
    createStartValue,
    setCreateStartValue,
    createDueValue,
    setCreateDueValue,
    createListId,
    setCreateListId,
    isUnscheduledCollapsed,
    setIsUnscheduledCollapsed,
    goToPrevious,
    goToNext,
    goToToday,
    changeViewMode,
    resetCreateDialog,
  };
};
