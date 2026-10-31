"use client";

import { useCallback, type MouseEvent } from "react";

import type { InputType as UpdateCardInput } from "@/actions/cards/update-card/types";
import { tr } from "@/lib/i18n";

import { isCalendarCardItem } from "../_lib/item-utils";
import type { CalendarOccurrence } from "../_types";

type BooleanRef = {
  current: boolean;
};

type CalendarCardModal = {
  onOpen: (id: string, options?: { checklistItemId?: string }) => void;
};

type UseCalendarCardInteractionsOptions = {
  boardId: string;
  cardModal: CalendarCardModal;
  suppressClickRef: BooleanRef;
  setExpandedDayKey: (dayKey: string | null) => void;
  executeUpdateCard: (input: UpdateCardInput) => void;
  setUpdateSuccessToast: (message: string | null) => void;
  /** Mở bộ chọn ngày/giờ làm của thẻ. */
  onPlanSchedule: (cardId: string) => void;
};

export const useCalendarCardInteractions = ({
  boardId,
  cardModal,
  suppressClickRef,
  setExpandedDayKey,
  executeUpdateCard,
  setUpdateSuccessToast,
  onPlanSchedule,
}: UseCalendarCardInteractionsOptions) => {
  const openCalendarCard = useCallback((
    cardId: string,
    event?: MouseEvent<HTMLElement>,
    options?: { checklistItemId?: string },
  ) => {
    event?.stopPropagation();
    if (suppressClickRef.current) {
      return;
    }

    setExpandedDayKey(null);
    cardModal.onOpen(cardId, options);
  }, [cardModal, setExpandedDayKey, suppressClickRef]);

  const openCalendarCardDirect = useCallback((
    cardId: string,
    options?: { checklistItemId?: string },
  ) => {
    cardModal.onOpen(cardId, options);
  }, [cardModal]);

  // Mọi thẻ đều có thể xếp lại lịch làm; chỉ buổi làm mới có lịch để bỏ. Không thao tác nào chạm hạn nộp.
  const canPlanSchedule = (occurrence: CalendarOccurrence) => isCalendarCardItem(occurrence.item);

  const canClearSchedule = (occurrence: CalendarOccurrence) => (
    isCalendarCardItem(occurrence.item) && occurrence.item.displayKind === "work"
  );

  const toggleCalendarCardComplete = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    setUpdateSuccessToast(occurrence.item.isCompleted
      ? tr("calendar.toast.markedIncomplete")
      : tr("calendar.toast.markedComplete"));

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      isCompleted: !occurrence.item.isCompleted,
    });
  };

  const planCalendarSchedule = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    onPlanSchedule(occurrence.item.cardId);
  };

  const clearCalendarSchedule = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    setUpdateSuccessToast(tr("calendar.toast.scheduleCleared"));

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      scheduledOn: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
    });
  };

  const handleQuickActionClick = (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    action();
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleUnscheduledCardClick = (cardId: string) => {
    if (suppressClickRef.current) {
      return;
    }

    cardModal.onOpen(cardId);
  };

  return {
    openCalendarCard,
    openCalendarCardDirect,
    canPlanSchedule,
    canClearSchedule,
    toggleCalendarCardComplete,
    planCalendarSchedule,
    clearCalendarSchedule,
    handleQuickActionClick,
    handleUnscheduledCardClick,
  };
};
