"use client";

import type { MouseEvent } from "react";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type { AppRouterInstance } from "@/web/shims/next-navigation";
import { toast } from "sonner";

import { createCard } from "@/actions/cards/create-card";
import { runCalendarAction } from "@/lib/calendar/calendar-action";
import { useAction } from "@/hooks/use-action";
import type { BoardCalendarResponse } from "@/types";

import {
  formatGmt7DateTimeInput,
  getGmt7DayKey,
  parseGmt7DateTimeInput,
} from "../_lib/date-utils";
import type { BoardCalendarList } from "../_types";

type CalendarCreateCardModal = {
  onOpen: (id: string, options?: { checklistItemId?: string }) => void;
};

type BooleanRef = {
  current: boolean;
};

type UseCalendarCreateCardOptions = {
  boardId: string;
  lists: BoardCalendarList[];
  query: UseQueryResult<BoardCalendarResponse>;
  queryClient: QueryClient;
  router: AppRouterInstance;
  cardModal: CalendarCreateCardModal;
  invalidateBoardCalendar: () => void;
  canOpenCreateDialog: boolean;
  setExpandedDayKey: (dayKey: string | null) => void;
  setCreateDialogDay: (day: Date | null) => void;
  createDialogDay: Date | null;
  createTitle: string;
  setCreateTitle: (title: string) => void;
  createStartValue: string;
  setCreateStartValue: (value: string) => void;
  createDueValue: string;
  setCreateDueValue: (value: string) => void;
  createListId: string;
  setCreateListId: (value: string | ((current: string) => string)) => void;
  resetDayViewCreateSelection: () => void;
  suppressClickRef: BooleanRef;
};

export const useCalendarCreateCard = ({
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
  resetDayViewCreateSelection,
  suppressClickRef,
}: UseCalendarCreateCardOptions) => {
  const resetCreateDialogState = () => {
    setCreateDialogDay(null);
    setCreateTitle("");
    setCreateStartValue("");
    setCreateDueValue("");
    resetDayViewCreateSelection();
    suppressClickRef.current = false;
  };

  const { execute: executeCreateCard, fieldErrors: createFieldErrors, isLoading: isCreatingCard } = useAction((input: Parameters<typeof createCard>[0]) => runCalendarAction(() => createCard(input)), {
    onSuccess: (data) => {
      resetCreateDialogState();
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      router.refresh();
      cardModal.onOpen(data.id);
    },
    onError: (error) => {
      toast.error(error);
      invalidateBoardCalendar();
      void query.refetch();
    },
  });

  const openCreateDialogWithRange = (startDate: Date, dueDate: Date) => {
    if (!canOpenCreateDialog) {
      return;
    }

    setExpandedDayKey(null);
    setCreateDialogDay(startDate);
    setCreateTitle("");
    setCreateStartValue(formatGmt7DateTimeInput(startDate));
    setCreateDueValue(formatGmt7DateTimeInput(dueDate));
    setCreateListId((value) =>
      lists.some((list) => list.id === value) ? value : lists[0]?.id || "",
    );
  };

  const openCreateDialog = (day: Date, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    openCreateDialogWithRange(day, day);
    setCreateStartValue("");
    setCreateDueValue("");
  };

  const closeCreateDialog = (open: boolean) => {
    if (open) {
      return;
    }

    resetCreateDialogState();
  };

  const submitCreateCard = () => {
    const title = createTitle.trim();

    if (!title || title.length < 1) {
      toast.error("Tiêu đề quá ngắn (tối thiểu 1 ký tự).");
      return;
    }

    if (!createListId) {
      toast.error("Vui lòng chọn danh sách đích.");
      return;
    }

    if (!createStartValue && !createDueValue && createDialogDay) {
      executeCreateCard({ title, boardId, listId: createListId, scheduledOn: getGmt7DayKey(createDialogDay) });
      return;
    }
    const startDate = parseGmt7DateTimeInput(createStartValue);
    const dueDate = parseGmt7DateTimeInput(createDueValue);

    if (!startDate || !dueDate) {
      toast.error("Khoảng thời gian tạo thẻ không hợp lệ.");
      return;
    }

    if (dueDate.getTime() <= startDate.getTime()) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }

    executeCreateCard({
      title,
      boardId,
      listId: createListId,
      scheduledStartAt: startDate.toISOString(),
      scheduledEndAt: dueDate.toISOString(),
    });
  };

  return {
    createFieldErrors,
    isCreatingCard,
    openCreateDialogWithRange,
    openCreateDialog,
    closeCreateDialog,
    submitCreateCard,
  };
};
