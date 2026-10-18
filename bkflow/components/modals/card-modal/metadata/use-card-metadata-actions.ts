"use client";

import { FormEvent, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/cards/update-card";
import {
  getDateTimezoneOffset,
  parseDateTimeLocalInput,
} from "@/lib/date-utils";

import { humanizeReminderMinutes } from "./metadata-utils";
import {
  patchBoardCardPreview,
  patchCardQueryData,
} from "../card-cache-utils";

interface UseCardMetadataActionsProps {
  data: CardWithList;
  boardId: string;
  queryClient: QueryClient;
  invalidateBoardCalendar: () => void;
  reminderValue: string;
  setIsDateOpen: (open: boolean) => void;
}

export const useCardMetadataActions = ({
  data,
  boardId,
  queryClient,
  invalidateBoardCalendar,
  reminderValue,
  setIsDateOpen,
}: UseCardMetadataActionsProps) => {
  const dateRequestRef = useRef<{
    previousStartDate: CardWithList["startDate"];
    previousDueDate: CardWithList["dueDate"];
    previousReminder: CardWithList["reminder"];
    previousIsCompleted: CardWithList["isCompleted"];
  } | null>(null);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      dateRequestRef.current = null;
      patchCardQueryData(queryClient, updatedCard.id, {
        startDate: updatedCard.startDate,
        dueDate: updatedCard.dueDate,
        isCompleted: updatedCard.isCompleted,
        reminder: updatedCard.reminder,
        reminderSetAt: updatedCard.reminderSetAt,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        startDate: updatedCard.startDate,
        dueDate: updatedCard.dueDate,
        isCompleted: updatedCard.isCompleted,
        reminder: updatedCard.reminder,
        reminderSetAt: updatedCard.reminderSetAt,
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", updatedCard.id],
      });
      invalidateBoardCalendar();

      if (updatedCard.isCompleted !== data.isCompleted) {
        const relatedDependencyCardIds = [
          ...data.blockedByDependencies.map((dependency) => dependency.blockerCardId),
          ...data.blockingDependencies.map((dependency) => dependency.blockedCardId),
        ];

        Array.from(new Set(relatedDependencyCardIds)).forEach((cardId) => {
          queryClient.invalidateQueries({
            queryKey: ["card", cardId],
          });
        });
      }
      setIsDateOpen(false);
    },
    onError: (error) => {
      const request = dateRequestRef.current;
      if (request) {
        patchCardQueryData(queryClient, data.id, {
          startDate: request.previousStartDate,
          dueDate: request.previousDueDate,
          reminder: request.previousReminder,
          isCompleted: request.previousIsCompleted,
        });
        patchBoardCardPreview(boardId, data.id, {
          startDate: request.previousStartDate,
          dueDate: request.previousDueDate,
          reminder: request.previousReminder,
          isCompleted: request.previousIsCompleted,
        });
        dateRequestRef.current = null;
      }
      toast.error(error);
    },
  });

  const updateDateRange = ({
    startDate,
    dueDate,
    isCompleted,
    reminder,
  }: {
    startDate?: Date | null;
    dueDate?: Date | null;
    isCompleted?: boolean;
    reminder?: string | null;
  }) => {
    if (isLoadingUpdate || dateRequestRef.current) {
      return;
    }

    if (
      startDate === undefined &&
      dueDate === undefined &&
      (isCompleted === undefined || isCompleted === data.isCompleted) &&
      (reminder === undefined || reminder === (data.reminder || "none"))
    ) {
      return;
    }

    const nextIsCompleted = dueDate === undefined
      ? isCompleted
      : (dueDate ? (isCompleted ?? data.isCompleted) : false);
    const nextReminder = dueDate === undefined
      ? reminder
      : (dueDate ? (reminder ?? reminderValue) : null);

    dateRequestRef.current = {
      previousStartDate: data.startDate,
      previousDueDate: data.dueDate,
      previousReminder: data.reminder,
      previousIsCompleted: data.isCompleted,
    };

    const patchObj: Partial<CardWithList> = {};
    if (startDate !== undefined) patchObj.startDate = startDate;
    if (dueDate !== undefined) patchObj.dueDate = dueDate;
    if (nextIsCompleted !== undefined) patchObj.isCompleted = nextIsCompleted;
    if (nextReminder !== undefined) patchObj.reminder = nextReminder === "none" ? null : nextReminder;

    patchCardQueryData(queryClient, data.id, patchObj);
    patchBoardCardPreview(boardId, data.id, patchObj);

    executeUpdateCard({
      id: data.id,
      boardId,
      ...(startDate !== undefined ? { startDate } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      dueDateTimezoneOffset: dueDate
        ? getDateTimezoneOffset(dueDate)
        : startDate
          ? getDateTimezoneOffset(startDate)
          : undefined,
      ...(nextIsCompleted !== undefined ? { isCompleted: nextIsCompleted } : {}),
      ...(nextReminder !== undefined ? { reminder: nextReminder } : {}),
    });
  };

  const updateDueDate = (
    nextDueDate: Date | null,
    nextReminder?: string | null,
    nextIsCompleted?: boolean,
  ) => {
    updateDateRange({
      dueDate: nextDueDate,
      reminder: nextReminder,
      isCompleted: nextIsCompleted,
    });
  };

  const updateStartDate = (nextStartDate: Date | null) => {
    updateDateRange({
      startDate: nextStartDate,
    });
  };

  const onDateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startDateString = formData.get("startDate") as string;
    const dueDateString = formData.get("dueDate") as string;
    const reminder = formData.get("reminder") as string;

    const parsedStartDate = parseDateTimeLocalInput(startDateString);
    const parsedDueDate = parseDateTimeLocalInput(dueDateString);

    if (startDateString && !parsedStartDate) {
      toast.error("Thời gian bắt đầu không hợp lệ.");
      return;
    }

    if (dueDateString && !parsedDueDate) {
      toast.error("Hạn chót không hợp lệ.");
      return;
    }

    if (parsedStartDate && parsedDueDate && parsedStartDate > parsedDueDate) {
      toast.error("Thời gian bắt đầu phải trước hạn chót.");
      return;
    }

    if (reminder && reminder !== "none") {
      if (!parsedDueDate) {
        toast.error("Phải đặt hạn chót mới có thể đặt nhắc nhở.");
        return;
      }

      const reminderMinutesMap: Record<string, number> = {
        at_due: 0,
        "5m_before": 5,
        "10m_before": 10,
        "15m_before": 15,
        "1h_before": 60,
        "2h_before": 120,
        "1d_before": 1440,
        "2d_before": 2880,
      };

      const minutesBefore = reminderMinutesMap[reminder];
      if (minutesBefore !== undefined) {
        const now = new Date();
        const reminderTime = new Date(parsedDueDate.getTime() - minutesBefore * 60 * 1000);
        if (reminderTime <= now) {
          const minutesUntilDue = Math.floor((parsedDueDate.getTime() - now.getTime()) / (60 * 1000));
          if (minutesUntilDue <= 0) {
            toast.error("Hạn chót đã qua, không thể đặt nhắc nhở.");
          } else {
            toast.error(
              `Thời gian nhắc nhở không hợp lệ. Thẻ chỉ còn ${humanizeReminderMinutes(minutesUntilDue)} — hãy chọn mốc nhắc ngắn hơn.`
            );
          }
          return;
        }
      }
    }

    updateDateRange({
      startDate: parsedStartDate,
      dueDate: parsedDueDate,
      isCompleted: data.isCompleted,
      reminder,
    });
  };

  const updateCompletion = (checked: boolean) => {
    executeUpdateCard({
      id: data.id,
      boardId,
      isCompleted: checked,
    });
  };

  return {
    isLoadingUpdate,
    updateDateRange,
    updateDueDate,
    updateStartDate,
    onDateSubmit,
    updateCompletion,
  };
};
