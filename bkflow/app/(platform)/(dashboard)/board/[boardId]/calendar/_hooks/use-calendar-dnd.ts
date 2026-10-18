"use client";

import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import type { InputType as SetChecklistItemDueDateInput } from "@/actions/checklists/set-checklist-item-due-date/types";
import type { ScheduleIntent } from "@/lib/calendar/schedule-command";
import {
  DAY_VIEW_SLOT_COUNT,
  DAY_VIEW_SLOT_HEIGHT,
  getDayViewDropDate,
  getDayViewSlotFromPointer,
} from "@/lib/calendar/calendar-day-view";
import {
  BOARD_CARD_CALENDAR_DRAG_MIME,
  type BoardCardCalendarDragPayload,
} from "@/lib/calendar/calendar-dnd";
import type { BoardCalendarUnscheduledCard } from "@/types";

import {
  copyDateToDay,
  getDayKey,
  getDefaultDueDateForDay,
  getGmt7DayKey,
  parseCalendarDate,
} from "../_lib/date-utils";
import {
  isCalendarCardItem,
  isCalendarChecklistItem,
} from "../_lib/item-utils";
import type {
  CalendarDragPayload,
  CalendarOccurrence,
  DayViewBlock,
  PositionedDayViewBlock,
} from "../_types";

type BooleanRef = {
  current: boolean;
};

type SchedulableCardPayload = {
  cardId: string;
  isCompleted: boolean;
};

type UseCalendarDndOptions = {
  boardId: string;
  anchorDate: Date;
  occurrencesById: Record<string, CalendarOccurrence>;
  dayViewBlocksById: Record<string, DayViewBlock>;
  scheduleCard: (cardId: string, intent: ScheduleIntent, successMessage?: string) => void;
  executeSetChecklistItemDueDate: (input: SetChecklistItemDueDateInput) => void;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  invalidateBoardCalendar: () => void;
  suppressClickRef: BooleanRef;
  setExpandedDayKey: (dayKey: string | null) => void;
  setUpdatingChecklistItemCardId: (cardId: string | null) => void;
  resetDayViewBlockResize: () => void;
  resetDayViewCreateSelection: () => void;
};

export const useCalendarDnd = ({
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
  resetDayViewCreateSelection,
}: UseCalendarDndOptions) => {
  const [draggingOccurrenceId, setDraggingOccurrenceId] = useState<string | null>(null);
  const [draggingUnscheduledCardId, setDraggingUnscheduledCardId] = useState<string | null>(null);
  const [draggingBoardCardId, setDraggingBoardCardId] = useState<string | null>(null);
  const [draggingDayViewBlockId, setDraggingDayViewBlockId] = useState<string | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);
  const [dragOverDaySlotIndex, setDragOverDaySlotIndex] = useState<number | null>(null);
  const [dragOverDayMinute, setDragOverDayMinute] = useState<number | null>(null);
  const dayViewDragSlotOffsetRef = useRef(0);

  const resetCalendarDragState = () => {
    setDraggingOccurrenceId(null);
    setDraggingUnscheduledCardId(null);
    setDraggingBoardCardId(null);
    setDraggingDayViewBlockId(null);
    resetDayViewBlockResize();
    resetDayViewCreateSelection();
    setDragOverDayKey(null);
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
    dayViewDragSlotOffsetRef.current = 0;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleOccurrenceDragStart = (
    event: DragEvent<HTMLDivElement>,
    occurrence: CalendarOccurrence,
  ) => {
    if (
      isUpdatingCardDate ||
      isUpdatingChecklistItemDueDate ||
      occurrence.kind === "range" ||
      (isCalendarCardItem(occurrence.item) && occurrence.item.displayKind !== undefined && occurrence.item.displayKind !== "work") ||
      (!isCalendarCardItem(occurrence.item) && !isCalendarChecklistItem(occurrence.item))
    ) {
      event.preventDefault();
      return;
    }

    const payload: CalendarDragPayload = {
      kind: "calendar-occurrence",
      occurrenceId: occurrence.id,
    };

    suppressClickRef.current = true;
    setDraggingOccurrenceId(occurrence.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", occurrence.id);
  };

  const handleOccurrenceDragEnd = () => {
    resetCalendarDragState();
  };

  const handleUnscheduledCardDragStart = (
    event: DragEvent<HTMLButtonElement>,
    card: BoardCalendarUnscheduledCard,
  ) => {
    if (isUpdatingCardDate || isUpdatingChecklistItemDueDate) {
      event.preventDefault();
      return;
    }

    const payload: CalendarDragPayload = {
      kind: "unscheduled-card",
      cardId: card.cardId,
      title: card.title,
      isCompleted: card.isCompleted,
    };

    suppressClickRef.current = true;
    setDraggingUnscheduledCardId(card.cardId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", card.cardId);
  };

  const handleUnscheduledCardDragEnd = () => {
    resetCalendarDragState();
  };

  const getDraggedOccurrence = (event: DragEvent<HTMLElement>) => {
    const payloadValue = event.dataTransfer.getData("application/json");

    if (payloadValue) {
      try {
        const payload = JSON.parse(payloadValue) as Partial<CalendarDragPayload>;

        if (
          (!payload.kind || payload.kind === "calendar-occurrence") &&
          "occurrenceId" in payload &&
          payload.occurrenceId
        ) {
          return occurrencesById[payload.occurrenceId] ?? null;
        }
      } catch {
        return null;
      }
    }

    const fallbackId = event.dataTransfer.getData("text/plain");

    return fallbackId ? occurrencesById[fallbackId] ?? null : null;
  };

  const getDraggedUnscheduledCard = (event: DragEvent<HTMLElement>) => {
    const payloadValue = event.dataTransfer.getData("application/json");

    if (!payloadValue) {
      return null;
    }

    try {
      const payload = JSON.parse(payloadValue) as Partial<CalendarDragPayload>;

      if (
        payload.kind !== "unscheduled-card" ||
        !("cardId" in payload) ||
        !payload.cardId
      ) {
        return null;
      }

      return {
        cardId: payload.cardId,
        title: "title" in payload && payload.title ? payload.title : "",
        isCompleted:
          "isCompleted" in payload && typeof payload.isCompleted === "boolean"
            ? payload.isCompleted
            : false,
      };
    } catch {
      return null;
    }
  };

  const getDraggedBoardCard = (event: DragEvent<HTMLElement>) => {
    const payloadValue =
      event.dataTransfer.getData(BOARD_CARD_CALENDAR_DRAG_MIME) ||
      event.dataTransfer.getData("application/json");

    if (!payloadValue) {
      return null;
    }

    try {
      const payload = JSON.parse(payloadValue) as Partial<BoardCardCalendarDragPayload>;

      if (
        payload.kind !== "board-card" ||
        !("cardId" in payload) ||
        !payload.cardId ||
        ("boardId" in payload && payload.boardId !== boardId)
      ) {
        return null;
      }

      return {
        cardId: payload.cardId,
        title: "title" in payload && payload.title ? payload.title : "",
        isCompleted:
          "isCompleted" in payload && typeof payload.isCompleted === "boolean"
            ? payload.isCompleted
            : false,
      };
    } catch {
      return null;
    }
  };

  const getDraggedDayViewCardBlock = (event: DragEvent<HTMLElement>) => {
    const payloadValue = event.dataTransfer.getData("application/json");

    if (!payloadValue) {
      return draggingDayViewBlockId ? dayViewBlocksById[draggingDayViewBlockId] ?? null : null;
    }

    try {
      const payload = JSON.parse(payloadValue) as Partial<CalendarDragPayload>;

      if (
        payload.kind !== "day-view-card-block" ||
        !("blockId" in payload) ||
        !payload.blockId
      ) {
        return null;
      }

      return dayViewBlocksById[payload.blockId] ?? null;
    } catch {
      return null;
    }
  };

  const moveDayViewCardBlock = (
    block: DayViewBlock,
    targetDate: Date,
  ) => {
    if (isCalendarChecklistItem(block.item)) {
      const currentDueDate = parseCalendarDate(block.item.dueDate);
      const nextDueDate = new Date(targetDate.getTime() + 15 * 60_000);

      if (currentDueDate?.getTime() === nextDueDate.getTime()) {
        resetCalendarDragState();
        return;
      }

      setUpdatingChecklistItemCardId(block.item.cardId);
      executeSetChecklistItemDueDate({
        boardId,
        cardId: block.item.cardId,
        id: block.item.checklistItemId,
        dueDate: nextDueDate,
      });
      return;
    }

    if (!isCalendarCardItem(block.item)) {
      toast.error("Chỉ hỗ trợ di chuyển thẻ trong Day View.");
      resetCalendarDragState();
      return;
    }

    if (parseCalendarDate(block.item.startDate)?.getTime() === targetDate.getTime()) {
      resetCalendarDragState();
      return;
    }

    scheduleCard(block.item.cardId, { type: "move", startsAt: targetDate.toISOString() }, "Đã di chuyển thẻ");
  };

  const updateOccurrenceDate = (occurrence: CalendarOccurrence, targetDay: Date) => {
    const { item } = occurrence;

    if (!isCalendarCardItem(item) && !isCalendarChecklistItem(item)) {
      toast.error("Không thể cập nhật mục lịch này.");
      handleOccurrenceDragEnd();
      return;
    }

    const currentStartDate = isCalendarCardItem(item)
      ? parseCalendarDate(item.startDate)
      : null;
    const currentDueDate = parseCalendarDate(item.dueDate);
    const targetDayKey = getDayKey(targetDay);
    const sourceDayKey = getDayKey(occurrence.date);

    if (targetDayKey === sourceDayKey) {
      handleOccurrenceDragEnd();
      return;
    }

    if (isCalendarChecklistItem(item)) {
      const nextDueDate = currentDueDate
        ? copyDateToDay(currentDueDate, targetDay)
        : getDefaultDueDateForDay(targetDay);

      setUpdatingChecklistItemCardId(item.cardId);
      executeSetChecklistItemDueDate({
        boardId,
        cardId: item.cardId,
        id: item.checklistItemId,
        dueDate: nextDueDate,
      });
      return;
    }

    // Chỉ dời lịch làm; hạn nộp và nhắc giữ nguyên.
    if (item.scheduledStartAt && currentStartDate) {
      const shiftMs = Date.parse(`${targetDayKey}T00:00:00Z`) - Date.parse(`${sourceDayKey}T00:00:00Z`);

      scheduleCard(
        item.cardId,
        { type: "move", startsAt: new Date(currentStartDate.getTime() + shiftMs).toISOString() },
        "Đã cập nhật ngày",
      );
      return;
    }

    scheduleCard(item.cardId, { type: "day", day: targetDayKey }, "Đã cập nhật ngày");
  };

  const scheduleCardForDay = (
    card: SchedulableCardPayload,
    targetDay: Date,
  ) => {
    scheduleCard(card.cardId, { type: "day", day: getDayKey(targetDay) }, "Đã lên lịch thẻ");
  };

  // Thả vào giờ chưa biết thời lượng: scheduleCard sẽ hỏi giờ kết thúc thay vì tự đặt 30/60 phút.
  const scheduleCardAtDate = (
    card: SchedulableCardPayload,
    startDate: Date,
  ) => {
    scheduleCard(card.cardId, { type: "time", startsAt: startDate.toISOString() }, "Đã lên lịch thẻ");
  };

  const handleDayViewBlockDragStart = (
    event: DragEvent<HTMLElement>,
    block: PositionedDayViewBlock,
  ) => {
    if (
      isUpdatingCardDate ||
      isUpdatingChecklistItemDueDate ||
      (
        !isCalendarCardItem(block.item) &&
        !isCalendarChecklistItem(block.item)
      ) ||
      (
        isCalendarCardItem(block.item) &&
        !block.item.startDate &&
        !block.item.dueDate
      ) ||
      (
        isCalendarChecklistItem(block.item) &&
        !block.item.dueDate
      )
    ) {
      event.preventDefault();
      return;
    }

    const blockRect = event.currentTarget.getBoundingClientRect();
    const blockSlotCount = Math.max(
      1,
      Math.round((block.endMinute - block.startMinute) / 15),
    );
    const grabbedSlotOffset = Math.floor(
      (event.clientY - blockRect.top) / DAY_VIEW_SLOT_HEIGHT,
    );

    dayViewDragSlotOffsetRef.current = Math.min(
      Math.max(grabbedSlotOffset, 0),
      blockSlotCount - 1,
    );

    const payload: CalendarDragPayload = {
      kind: "day-view-card-block",
      blockId: block.id,
    };

    suppressClickRef.current = true;
    setExpandedDayKey(null);
    setDraggingDayViewBlockId(block.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", block.item.cardId);
  };

  const handleDayViewBlockDragEnd = () => {
    resetCalendarDragState();
  };

  const getDayViewTargetSlotIndex = (
    event: DragEvent<HTMLDivElement>,
    gridElement: HTMLDivElement,
  ) => {
    const pointerSlotIndex = getDayViewSlotFromPointer(event, gridElement);
    const slotOffset = draggingDayViewBlockId
      ? dayViewDragSlotOffsetRef.current
      : 0;

    return Math.min(
      Math.max(pointerSlotIndex - slotOffset, 0),
      DAY_VIEW_SLOT_COUNT - 1,
    );
  };

  const handleDayDragOver = (event: DragEvent<HTMLDivElement>, dayKey: string) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    const hasBoardCardPayload =
      dragTypes.includes(BOARD_CARD_CALENDAR_DRAG_MIME) ||
      dragTypes.includes("application/json");

    if (!draggingOccurrenceId && !draggingUnscheduledCardId && !hasBoardCardPayload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (hasBoardCardPayload) {
      const fallbackId = event.dataTransfer.getData("text/plain");
      setDraggingBoardCardId(fallbackId || "external");
    }
    setDragOverDayKey(dayKey);
  };

  const handleDayDrop = (event: DragEvent<HTMLDivElement>, day: Date) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;

    const unscheduledCard = getDraggedUnscheduledCard(event);

    if (unscheduledCard) {
      scheduleCardForDay(unscheduledCard, day);
      return;
    }

    const boardCard = getDraggedBoardCard(event);

    if (boardCard) {
      scheduleCardForDay(boardCard, day);
      return;
    }

    const occurrence = getDraggedOccurrence(event);

    if (!occurrence) {
      toast.error("Không thể xác định mục lịch đang kéo.");
      invalidateBoardCalendar();
      resetCalendarDragState();
      return;
    }

    updateOccurrenceDate(occurrence, day);
  };

  const handleDayViewDragOver = (event: DragEvent<HTMLDivElement>) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    const hasBoardCardPayload =
      dragTypes.includes(BOARD_CARD_CALENDAR_DRAG_MIME) ||
      (
        dragTypes.includes("application/json") &&
        !draggingOccurrenceId &&
        !draggingUnscheduledCardId &&
        !draggingDayViewBlockId
      );

    if (!draggingUnscheduledCardId && !draggingDayViewBlockId && !hasBoardCardPayload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const slotIndex = getDayViewTargetSlotIndex(event, event.currentTarget);
    setDragOverDayKey(getGmt7DayKey(anchorDate));
    setDragOverDaySlotIndex(slotIndex);
    setDragOverDayMinute(null);

    if (hasBoardCardPayload) {
      const fallbackId = event.dataTransfer.getData("text/plain");
      setDraggingBoardCardId(fallbackId || "external");
    }
  };

  const handleDayViewDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
  };

  const handleDayViewDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;

    const slotIndex = getDayViewTargetSlotIndex(event, event.currentTarget);
    const startDate = getDayViewDropDate(anchorDate, slotIndex);
    const unscheduledCard = getDraggedUnscheduledCard(event);

    if (unscheduledCard) {
      scheduleCardAtDate(unscheduledCard, startDate);
      return;
    }

    const boardCard = getDraggedBoardCard(event);

    if (boardCard) {
      scheduleCardAtDate(boardCard, startDate);
      return;
    }

    const dayViewBlock = getDraggedDayViewCardBlock(event);

    if (dayViewBlock) {
      moveDayViewCardBlock(dayViewBlock, startDate);
      return;
    }

    toast.error("Không thể xác định thẻ đang kéo.");
    invalidateBoardCalendar();
    resetCalendarDragState();
  };

  return {
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
  };
};
