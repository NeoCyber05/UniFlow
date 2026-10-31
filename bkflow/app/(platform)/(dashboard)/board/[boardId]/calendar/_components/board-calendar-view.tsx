"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  blur,
  ReducedMotionConfig,
  shift,
  transition as motionTransition,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import { useRouter } from "@/web/shims/next-navigation";
import { TaskDetailPanel } from "@/components/my-tasks/task-detail-panel";
import { useTaskPanelParam } from "@/hooks/use-task-panel-param";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { getTodayKey } from "@/lib/calendar/calendar-navigation";
import { tr } from "@/lib/i18n";
import type { ScheduleIntent } from "@/lib/calendar/schedule-command";
import {
  MONTH_VISIBLE_DESKTOP,
  MONTH_VISIBLE_MOBILE,
  getWeekDays,
  WEEK_VISIBLE_DESKTOP,
  WEEK_VISIBLE_MOBILE,
} from "../_lib/constants";
import {
  formatDayTitle,
  formatCalendarDate,
  getGmt7Parts,
  formatGmt7Time,
  getGmt7DayKey,
} from "../_lib/date-utils";
import { isOverdue } from "../_lib/item-utils";
import { BoardCalendarRealtimeSubscriptions } from "./board-calendar/realtime-subscriptions";
import { CreateCardDialog } from "./board-calendar/create-card-dialog";
import { ScheduleDialog, type ScheduleDialogState } from "./board-calendar/schedule-dialog";
import { UnscheduledPanel } from "./board-calendar/unscheduled-panel";
import type { BoardCalendarViewProps } from "../_types";
import { useCalendarQuery } from "../_hooks/use-calendar-query";
import { useCalendarCardActions } from "../_hooks/use-calendar-card-actions";
import { useCalendarCardInteractions } from "../_hooks/use-calendar-card-interactions";
import { useCalendarCreateCard } from "../_hooks/use-calendar-create-card";
import { useCalendarDayViewCreate } from "../_hooks/use-calendar-day-view-create";
import { useCalendarRealtime } from "../_hooks/use-calendar-realtime";
import { useCalendarState } from "../_hooks/use-calendar-state";
import { CalendarDayTimeline } from "./calendar-day-timeline";
import { CalendarDayView } from "./calendar-day-view";
import { CalendarEmptyState } from "./calendar-empty-state";
import { CalendarErrorState } from "./calendar-error-state";
import { CalendarLoadingState } from "./calendar-loading-state";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarWeekView } from "./calendar-week-view";
import { ExpandedDayPanel } from "./expanded-day-panel";
import { useCalendarResize } from "../_hooks/use-calendar-resize";
import { useCalendarDnd } from "../_hooks/use-calendar-dnd";
import { useCalendarGridSize } from "../_hooks/use-calendar-grid-size";
import { ColumnResizeHandles } from "./board-calendar/grid-resize-handles";

export const BoardCalendarView = ({
  boardId,
  lists,
  currentUserId,
  currentBoardMemberId,
  defaultUnscheduledCollapsed = false,
  variant = "default",
  initialData,
}: BoardCalendarViewProps) => {
  const router = useRouter();
  // Mở thẻ ở panel chi tiết như trang Việc cần làm (?task=<id>), không dùng modal giữa màn hình
  const { taskId, openTask, closeTask } = useTaskPanelParam();
  const cardModal = useMemo(() => ({ onOpen: openTask, onClose: closeTask }), [openTask, closeTask]);
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const {
    viewMode,
    anchorDate,
    setAnchorDate,
    currentTime,
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
  } = useCalendarState({ boardId, defaultUnscheduledCollapsed, lists });
  const suppressClickRef = useRef(false);
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  const setSelectedLists = useBoardFilters((state) => state.setSelectedLists);
  const {
    fromIso,
    toIso,
    days,
    query,
    unscheduledCards,
    filtersAreActive,
    items,
    filteredUnscheduledCards,
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
  } = useCalendarQuery({
    boardId,
    viewMode,
    anchorDate,
    filters,
    currentBoardMemberId,
    initialData,
  });
  const {
    realtimeChannelName,
    realtimeEnabled,
    handleCalendarRealtime,
    handleCalendarRealtimeWithRefresh,
    handleBoardDeletedRealtime,
    handleAccessRevokedRealtime,
  } = useCalendarRealtime({
    boardId,
    currentUserId,
    router,
    cardModal,
    invalidateBoardCalendar,
  });
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setExpandedDayKey(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filters, setExpandedDayKey]);
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setOpenDayOverflowGroupId(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dayViewBlocks, setOpenDayOverflowGroupId]);
  const expandedDayItems = expandedDayKey
    ? [
      ...(rangeOccurrencesByDay[expandedDayKey] ?? []),
      ...(occurrencesByDay[expandedDayKey] ?? []),
    ]
    : [];

  const monthParts = getGmt7Parts(anchorDate);
  const monthLabel = tr("calendar.toolbar.monthTitle", { month: monthParts.month + 1, year: monthParts.year });
  const weekLabel = tr("calendar.toolbar.weekTitle", { from: formatCalendarDate(new Date(fromIso)), to: formatCalendarDate(new Date(Date.parse(toIso) - 1)) });
  const dayLabel = formatDayTitle(anchorDate);
  // Hướng chuyển khoảng xem (tới = 1, lui = -1) để lưới trượt đúng chiều
  const [rangeNav, setRangeNav] = useState({ from: fromIso, mode: viewMode, dir: 0 });
  if (rangeNav.from !== fromIso || rangeNav.mode !== viewMode) {
    setRangeNav({ from: fromIso, mode: viewMode, dir: rangeNav.mode !== viewMode ? 0 : fromIso > rangeNav.from ? 1 : -1 });
  }
  const panelIn = useTempoTransition(motionTransition.panelIn);
  const panelOut = useTempoTransition(motionTransition.panelOut);
  const sheetIn = useTempoTransition(motionTransition.sheet);
  const dismiss = useTempoTransition(motionTransition.dismiss);
  const disclosure = useTempoTransition(motionTransition.disclosure);
  const rangeVariants: Variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * shift.tabs }),
    center: { opacity: 1, x: 0, transition: panelIn },
    exit: (dir: number) => ({ opacity: 0, x: -dir * shift.tabs, transition: panelOut }),
  };
  const rangeLabel = `${formatCalendarDate(new Date(fromIso))} - ${formatCalendarDate(new Date(Date.parse(toIso) - 1))}`;
  const titleLabel = viewMode === "month"
    ? monthLabel
    : viewMode === "week"
      ? weekLabel
      : dayLabel;
  const previousLabel = viewMode === "month"
    ? tr("calendar.toolbar.prevMonth")
    : viewMode === "week"
      ? tr("calendar.toolbar.prevWeek")
      : tr("calendar.toolbar.prevDay");
  const nextLabel = viewMode === "month"
    ? tr("calendar.toolbar.nextMonth")
    : viewMode === "week"
      ? tr("calendar.toolbar.nextWeek")
      : tr("calendar.toolbar.nextDay");
  const currentMonth = anchorDate;
  const maxVisibleDesktop = viewMode === "month" ? MONTH_VISIBLE_DESKTOP : WEEK_VISIBLE_DESKTOP;
  const maxVisibleMobile = viewMode === "month" ? MONTH_VISIBLE_MOBILE : WEEK_VISIBLE_MOBILE;
  const grid = useCalendarGridSize(viewMode);
  const selectedCreateDayLabel = createDialogDay
    ? formatDayTitle(createDialogDay)
    : "";
  const countCards = (list: typeof items) => new Set(list.map((item) => item.cardId)).size;
  const scheduledItemsCount = countCards(items);
  const completedItemsCount = countCards(items.filter((item) => item.isCompleted));
  const overdueItemsCount = countCards(items.filter(isOverdue));
  const [scheduleDialog, setScheduleDialog] = useState<ScheduleDialogState | null>(null);
  const cardTitleOf = (cardId: string) =>
    query.data?.items.find((item) => item.cardId === cardId)?.title ??
    query.data?.unscheduledCards.find((card) => card.cardId === cardId)?.title ??
    "";
  const openScheduleDialog = (cardId: string) => {
    const card = query.data?.items.find(
      (item) => item.type === "card" && item.cardId === cardId,
    );
    const raw = card?.type === "card" ? card : null;
    const startAt = raw?.scheduledStartAt ? new Date(raw.scheduledStartAt) : null;
    const endAt = raw?.scheduledEndAt ? new Date(raw.scheduledEndAt) : null;

    setScheduleDialog({
      cardId,
      cardTitle: cardTitleOf(cardId),
      mode: "plan",
      day: raw?.scheduledOn ?? (startAt ? getGmt7DayKey(startAt) : getGmt7DayKey(anchorDate)),
      start: startAt ? formatGmt7Time(startAt) : "",
      endDay: endAt ? getGmt7DayKey(endAt) : getGmt7DayKey(anchorDate),
      end: endAt ? formatGmt7Time(endAt) : "",
      hasSchedule: !!(raw?.scheduledOn || startAt),
    });
  };
  const openNeedsEndDialog = (draft: { cardId: string; startsAt: string }) => {
    const startsAt = new Date(draft.startsAt);

    setScheduleDialog({
      cardId: draft.cardId,
      cardTitle: cardTitleOf(draft.cardId),
      mode: "needs-end",
      day: getGmt7DayKey(startsAt),
      start: formatGmt7Time(startsAt),
      endDay: getGmt7DayKey(startsAt),
      end: "",
      hasSchedule: false,
    });
  };

  const {
    executeUpdateCard,
    scheduleCard,
    saveError,
    executeSetChecklistItemDueDate,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    setUpdateSuccessToast,
    setUpdatingChecklistItemCardId,
  } = useCalendarCardActions({
    query,
    queryClient,
    router,
    invalidateBoardCalendar,
    setExpandedDayKey,
    onUpdateComplete: () => {
      resetCalendarDragState();
      resetRangeResize();
      resetDayViewBlockResize();
    },
    onChecklistComplete: () => {
      handleOccurrenceDragEnd();
    },
    onNeedsEnd: openNeedsEndDialog,
    onUpdateSuccess: () => setScheduleDialog(null),
  });
  const {
    resizingRange,
    resizingDayViewBlock,
    resetRangeResize,
    resetDayViewBlockResize,
    handleDayViewBlockResizeStart,
    handleDayViewBlockResizeMove,
    handleDayViewBlockResizeEnd,
    handleRangeResizeStart,
    handleRangeResizeMove,
    handleRangeResizeEnd,
  } = useCalendarResize({
    anchorDate,
    daysByKey,
    scheduleCard,
    setUpdateSuccessToast,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    invalidateBoardCalendar,
    refetchCalendar: () => {
      void query.refetch();
    },
    suppressClickRef,
    setExpandedDayKey,
    setDayViewCreateSelection: (selection) => setDayViewCreateSelection(selection),
    setDragOverDayKey: (dayKey) => setDragOverDayKey(dayKey),
    setDragOverDaySlotIndex: (slotIndex) => setDragOverDaySlotIndex(slotIndex),
    setDragOverDayMinute: (minute) => setDragOverDayMinute(minute),
  });
  const {
    draggingOccurrenceId,
    draggingUnscheduledCardId,
    draggingBoardCardId,
    draggingDayViewBlockId,
    dragOverDayKey,
    setDragOverDayKey,
    dragOverDaySlotIndex,
    setDragOverDaySlotIndex,
    dragOverDayMinute,
    setDragOverDayMinute,
    resetCalendarDragState,
    handleOccurrenceDragStart,
    handleOccurrenceDragEnd,
    handleUnscheduledCardDragStart,
    handleUnscheduledCardDragEnd,
    handleDayViewBlockDragStart,
    handleDayViewBlockDragEnd,
    handleDayDragOver,
    handleDayDrop,
    handleDayViewDragOver,
    handleDayViewDragLeave,
    handleDayViewDrop,
  } = useCalendarDnd({
    boardId,
    anchorDate,
    occurrencesById,
    dayViewBlocksById,
    scheduleCard,
    executeUpdateCard,
    setUpdateSuccessToast,
    executeSetChecklistItemDueDate,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    invalidateBoardCalendar,
    suppressClickRef,
    setExpandedDayKey,
    setUpdatingChecklistItemCardId,
    resetDayViewBlockResize,
    resetDayViewCreateSelection: () => resetDayViewCreateSelection(),
  });
  const canOpenCreateDialog = !(
    draggingOccurrenceId ||
    draggingUnscheduledCardId ||
    draggingBoardCardId ||
    draggingDayViewBlockId ||
    resizingRange ||
    resizingDayViewBlock ||
    isUpdatingCardDate ||
    isUpdatingChecklistItemDueDate ||
    lists.length === 0
  );
  const {
    createFieldErrors,
    isCreatingCard,
    openCreateDialogWithRange,
    openCreateDialog,
    closeCreateDialog,
    submitCreateCard,
  } = useCalendarCreateCard({
    boardId,
    lists,
    query,
    queryClient,
    router,
    cardModal,
    invalidateBoardCalendar,
    canOpenCreateDialog,
    setExpandedDayKey,
    setCreateDialogDay,
    createDialogDay,
    createTitle,
    setCreateTitle,
    createStartValue,
    setCreateStartValue,
    createDueValue,
    setCreateDueValue,
    createListId,
    setCreateListId,
    resetDayViewCreateSelection: () => resetDayViewCreateSelection(),
    suppressClickRef,
  });
  const {
    setDayViewCreateSelection,
    dayViewCreatePreview,
    resetDayViewCreateSelection,
    handleDayViewCreatePointerDown,
    handleDayViewCreatePointerMove,
    handleDayViewCreatePointerEnd,
  } = useCalendarDayViewCreate({
    anchorDate,
    isInteractionBlocked: !!(
      draggingOccurrenceId ||
      draggingUnscheduledCardId ||
      draggingBoardCardId ||
      draggingDayViewBlockId ||
      resizingRange ||
      resizingDayViewBlock ||
      isUpdatingCardDate ||
      isUpdatingChecklistItemDueDate ||
      isCreatingCard
    ),
    canCreate: lists.length > 0,
    suppressClickRef,
    setExpandedDayKey,
    setOpenDayOverflowGroupId,
    openCreateDialogWithRange,
  });
  const {
    openCalendarCard,
    openCalendarCardDirect,
    canPlanSchedule,
    canClearSchedule,
    toggleCalendarCardComplete,
    planCalendarSchedule,
    clearCalendarSchedule,
    handleQuickActionClick,
    handleUnscheduledCardClick,
  } = useCalendarCardInteractions({
    boardId,
    cardModal,
    suppressClickRef,
    setExpandedDayKey,
    executeUpdateCard,
    setUpdateSuccessToast,
    onPlanSchedule: openScheduleDialog,
  });
  const renderCalendarDayTimeGrid = (isSkeleton = false) => (
    <CalendarDayView
      dayViewProps={{
        anchorDate,
        currentTime,
        isSkeleton,
        deadlineMarkers: dayTimeline.markers.map((entry) => {
          const at = new Date(entry.startsAt!);
          const { hours, minutes } = getGmt7Parts(at);

          return {
            key: entry.key,
            cardId: entry.cardId,
            title: entry.title ?? dayCardMeta[entry.cardId]?.title ?? tr("calendar.common.cardFallback"),
            label: entry.kind === "checklist-deadline" ? tr("calendar.marker.checklistDeadlineShort") : entry.kind === "deadline" ? tr("calendar.occurrence.deadline") : tr("calendar.occurrence.start"),
            minute: hours * 60 + minutes,
            time: formatGmt7Time(at),
            isCompleted: dayCardMeta[entry.cardId]?.isCompleted ?? false,
          };
        }),
        dayViewBlocks,
        desktopDayViewLayout,
        mobileDayViewLayout,
        dayViewCreatePreview,
        openDayOverflowGroupId,
        resizingDayViewBlock,
        dragOverDaySlotIndex,
        dragOverDayMinute,
        draggingDayViewBlockId,
        isUpdatingCardDate,
        isUpdatingChecklistItemDueDate,
        onOpenDayOverflowGroupChange: setOpenDayOverflowGroupId,
        onOpenCard: openCalendarCard,
        onDayViewBlockDragStart: handleDayViewBlockDragStart,
        onDayViewBlockDragEnd: handleDayViewBlockDragEnd,
        onDayViewBlockResizeStart: handleDayViewBlockResizeStart,
        onDayViewBlockResizeMove: handleDayViewBlockResizeMove,
        onDayViewBlockResizeEnd: handleDayViewBlockResizeEnd,
        onDayViewBlockResizeCancel: resetDayViewBlockResize,
        onDayViewCreatePointerDown: handleDayViewCreatePointerDown,
        onDayViewCreatePointerMove: handleDayViewCreatePointerMove,
        onDayViewCreatePointerEnd: handleDayViewCreatePointerEnd,
        onDayViewCreatePointerCancel: resetDayViewCreateSelection,
        onDayViewDragOver: handleDayViewDragOver,
        onDayViewDragLeave: handleDayViewDragLeave,
        onDayViewDrop: handleDayViewDrop,
      }}
    />
  );

  const calendarWeekRowProps = {
    viewMode,
    variant,
    currentMonth,
    maxVisibleDesktop,
    maxVisibleMobile,
    listsCount: lists.length,
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
    onOpenCard: openCalendarCard,
    onOpenCardDirect: openCalendarCardDirect,
    onOccurrenceDragStart: handleOccurrenceDragStart,
    onOccurrenceDragEnd: handleOccurrenceDragEnd,
    onQuickActionClick: handleQuickActionClick,
    onToggleComplete: toggleCalendarCardComplete,
    onPlanSchedule: planCalendarSchedule,
    onClearSchedule: clearCalendarSchedule,
    onOpenCreateDialog: openCreateDialog,
    onSetExpandedDayKey: setExpandedDayKey,
    onDayDragOver: handleDayDragOver,
    onDayDrop: handleDayDrop,
    onDayDragLeave: (dayKey: string) =>
      setDragOverDayKey((value) => (value === dayKey ? null : value)),
    onRangeResizeStart: handleRangeResizeStart,
    onRangeResizeMove: handleRangeResizeMove,
    onRangeResizeEnd: handleRangeResizeEnd,
    onRangeResizeCancel: resetRangeResize,
    grid,
  };



  return (
    <>
    <BoardCalendarRealtimeSubscriptions
      channelName={realtimeChannelName}
      enabled={realtimeEnabled}
      onInvalidate={handleCalendarRealtime}
      onRefresh={handleCalendarRealtimeWithRefresh}
      onBoardDeleted={handleBoardDeletedRealtime}
      onAccessRevoked={handleAccessRevokedRealtime}
    />
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/20 bg-white/95 shadow-xl backdrop-blur">
      <CalendarToolbar
        titleLabel={titleLabel}
        rangeLabel={rangeLabel}
        scheduledItemsCount={scheduledItemsCount}
        completedItemsCount={completedItemsCount}
        overdueItemsCount={overdueItemsCount}
        isUnscheduledCollapsed={isUnscheduledCollapsed}
        filteredUnscheduledCount={filteredUnscheduledCards.length}
        viewMode={viewMode}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        onToggleUnscheduledCollapsed={() => setIsUnscheduledCollapsed((value) => !value)}
        onChangeViewMode={changeViewMode}
        onPrevious={goToPrevious}
        onToday={goToToday}
        onNext={goToNext}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4" style={grid.gridStyle}>
        {viewMode === "month" && (
          <div className="relative grid [grid-template-columns:var(--cal-cols)] rounded-t-xl border border-b-0 border-neutral-200 bg-neutral-50/80">
            {getWeekDays().map((day, dayIndex) => (
              <div
                key={day}
                className={cn(
                  "border-r border-neutral-200 px-1.5 py-2 text-center text-[11px] font-bold uppercase tracking-wide last:border-r-0",
                  dayIndex >= 5 ? "text-neutral-400" : "text-neutral-500",
                )}
              >
                {day}
              </div>
            ))}
            <ColumnResizeHandles grid={grid} />
          </div>
        )}

        <ReducedMotionConfig>
        <AnimatePresence mode="wait" initial={false} custom={rangeNav.dir}>
        <motion.div
          key={`${viewMode}:${fromIso}`}
          custom={rangeNav.dir}
          variants={rangeVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
        {query.isLoading && viewMode === "day" && renderCalendarDayTimeGrid(true)}

        {query.isLoading && viewMode !== "day" && (
          <CalendarLoadingState
            viewMode={viewMode}
            days={days}
          />
        )}

        {query.isError && <CalendarErrorState />}

        {query.isSuccess && (
          <>
            {viewMode === "month" ? (
              <CalendarMonthView
                weekRows={weekRows}
                rowProps={calendarWeekRowProps}
              />
            ) : viewMode === "week" ? (
              <CalendarWeekView
                days={days}
                weekRows={weekRows}
                rowProps={calendarWeekRowProps}
              />
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <CalendarDayTimeline
                  day={getGmt7DayKey(anchorDate)}
                  today={getTodayKey(currentTime)}
                  timeline={dayTimeline}
                  cardMeta={dayCardMeta}
                  onOpenTask={(cardId) => openCalendarCardDirect(cardId)}
                  onSelectDay={(day) => setAnchorDate(new Date(`${day}T12:00:00+07:00`))}
                  onPlanTask={openScheduleDialog}
                  onCreateInGap={(gap) => openCreateDialogWithRange(new Date(gap.startsAt), new Date(gap.endsAt))}
                />
                <div className="min-w-0 lg:order-first">{renderCalendarDayTimeGrid()}</div>
              </div>
            )}
            {viewMode !== "day" && items.length === 0 && (
              <CalendarEmptyState
                viewMode={viewMode}
                filtersAreActive={filtersAreActive}
              />
            )}

            <AnimatePresence initial={false}>
            {expandedDayKey && expandedDayItems.length > 0 && (
              <motion.div
                key={expandedDayKey}
                initial={{ height: 0, opacity: 0, filter: blur.disclosure }}
                animate={{ height: "auto", opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                exit={{ height: 0, opacity: 0, filter: blur.disclosure }}
                transition={disclosure}
                style={{ overflow: "hidden" }}
              >
              <ExpandedDayPanel
                dayKey={expandedDayKey}
                occurrences={expandedDayItems}
                isUpdatingCardDate={isUpdatingCardDate}
                canPlanSchedule={canPlanSchedule}
                canClearSchedule={canClearSchedule}
                onOpenCard={openCalendarCard}
                onOpenCardDirect={openCalendarCardDirect}
                onQuickActionClick={handleQuickActionClick}
                onToggleComplete={toggleCalendarCardComplete}
                onPlanSchedule={planCalendarSchedule}
                onClearSchedule={clearCalendarSchedule}
                onClose={() => setExpandedDayKey(null)}
              />
              </motion.div>
            )}
            </AnimatePresence>
          </>
        )}
        </motion.div>
        </AnimatePresence>
        </ReducedMotionConfig>
      </div>
    </section>
    {taskId && <TaskDetailPanel taskId={taskId} onClose={closeTask} desktopClassName="top-0 h-full" />}
    <ReducedMotionConfig>
    <AnimatePresence initial={false}>
    {!isUnscheduledCollapsed && (
    <motion.div
      key="unscheduled-panel"
      className="flex min-h-0 w-full shrink-0 lg:w-auto"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0, transition: sheetIn }}
      exit={{ opacity: 0, x: 16, transition: dismiss }}
    >
    <UnscheduledPanel
      boardId={boardId}
      lists={lists}
      variant={variant}
      isCollapsed={isUnscheduledCollapsed}
      setIsCollapsed={setIsUnscheduledCollapsed}
      filtersAreActive={filtersAreActive}
      selectedListIds={filters.selectedListIds}
      unscheduledCards={unscheduledCards}
      filteredUnscheduledCards={filteredUnscheduledCards}
      isLoading={query.isLoading}
      isError={query.isError}
      isSuccess={query.isSuccess}
      isUpdatingCardDate={isUpdatingCardDate}
      isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
      draggingUnscheduledCardId={draggingUnscheduledCardId}
      onSelectedListIdsChange={(listIds) => setSelectedLists(boardId, listIds)}
      onCardClick={(card) => handleUnscheduledCardClick(card.cardId)}
      onPlanCard={(card) => openScheduleDialog(card.cardId)}
      onCardDragStart={handleUnscheduledCardDragStart}
      onCardDragEnd={handleUnscheduledCardDragEnd}
    />
    </motion.div>
    )}
    </AnimatePresence>
    </ReducedMotionConfig>
    </div>
    <ScheduleDialog
      state={scheduleDialog}
      saveError={saveError}
      isLoading={isUpdatingCardDate}
      onClose={() => setScheduleDialog(null)}
      onSubmit={(cardId: string, intent: ScheduleIntent) => {
        scheduleCard(cardId, intent, tr("calendar.toast.scheduleUpdated"));
      }}
    />
    <CreateCardDialog
      open={!!createDialogDay}
      selectedDayLabel={selectedCreateDayLabel}
      title={createTitle}
      startValue={createStartValue}
      dueValue={createDueValue}
      listId={createListId}
      lists={lists}
      fieldErrors={createFieldErrors}
      isLoading={isCreatingCard}
      onOpenChange={closeCreateDialog}
      onTitleChange={setCreateTitle}
      onStartValueChange={setCreateStartValue}
      onDueValueChange={setCreateDueValue}
      onListIdChange={setCreateListId}
      onSubmit={submitCreateCard}
    />
    </>
  );
};
