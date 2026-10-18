"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/web/shims/next-navigation";
import { useCardModal } from "@/hooks/use-card-modal";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { getTodayKey } from "@/lib/calendar/calendar-navigation";
import type { ScheduleIntent } from "@/lib/calendar/schedule-command";
import {
  MONTH_VISIBLE_DESKTOP,
  MONTH_VISIBLE_MOBILE,
  WEEK_DAYS,
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

export const BoardCalendarView = ({
  boardId,
  lists,
  currentUserId,
  currentBoardMemberId,
  defaultUnscheduledCollapsed = false,
  variant = "default",
}: BoardCalendarViewProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
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
  const monthLabel = `Tháng ${monthParts.month + 1}, ${monthParts.year}`;
  const weekLabel = `Tuần ${formatCalendarDate(new Date(fromIso))} - ${formatCalendarDate(new Date(Date.parse(toIso) - 1))}`;
  const dayLabel = formatDayTitle(anchorDate);
  const rangeLabel = `${formatCalendarDate(new Date(fromIso))} - ${formatCalendarDate(new Date(Date.parse(toIso) - 1))}`;
  const titleLabel = viewMode === "month"
    ? monthLabel
    : viewMode === "week"
      ? weekLabel
      : dayLabel;
  const previousLabel = viewMode === "month"
    ? "Tháng trước"
    : viewMode === "week"
      ? "Tuần trước"
      : "Ngày trước";
  const nextLabel = viewMode === "month"
    ? "Tháng sau"
    : viewMode === "week"
      ? "Tuần sau"
      : "Ngày sau";
  const currentMonth = anchorDate;
  const maxVisibleDesktop = viewMode === "month" ? MONTH_VISIBLE_DESKTOP : WEEK_VISIBLE_DESKTOP;
  const maxVisibleMobile = viewMode === "month" ? MONTH_VISIBLE_MOBILE : WEEK_VISIBLE_MOBILE;
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
      setDragOverDayKey((value) => value === dayKey ? null : value),
    onRangeResizeStart: handleRangeResizeStart,
    onRangeResizeMove: handleRangeResizeMove,
    onRangeResizeEnd: handleRangeResizeEnd,
    onRangeResizeCancel: resetRangeResize,
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
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {viewMode === "month" && (
          <div className="grid grid-cols-7 rounded-t-lg border border-b-0 border-neutral-200 bg-neutral-50">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="border-r border-neutral-200 px-1.5 py-2 text-center text-[11px] font-semibold uppercase text-neutral-500 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
        )}

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
              <div className="space-y-3">
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
                <details className="rounded-lg border border-neutral-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-neutral-700">Lưới giờ — kéo, đổi độ dài hoặc thêm buổi làm</summary>
                  <div className="mt-3">{renderCalendarDayTimeGrid()}</div>
                </details>
              </div>
            )}
            {viewMode !== "day" && items.length === 0 && (
              <CalendarEmptyState
                viewMode={viewMode}
                filtersAreActive={filtersAreActive}
              />
            )}

            {expandedDayKey && expandedDayItems.length > 0 && (
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
            )}
          </>
        )}
      </div>
    </section>
    <UnscheduledPanel
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
    </div>
    <ScheduleDialog
      state={scheduleDialog}
      saveError={saveError}
      isLoading={isUpdatingCardDate}
      onClose={() => setScheduleDialog(null)}
      onSubmit={(cardId: string, intent: ScheduleIntent) => {
        scheduleCard(cardId, intent, "Đã cập nhật lịch làm");
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
