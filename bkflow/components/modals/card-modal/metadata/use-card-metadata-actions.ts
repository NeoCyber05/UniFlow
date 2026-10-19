"use client";

import { useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/cards/update-card";
import type { InputType as UpdateCardInput } from "@/actions/cards/update-card/types";
import { taskDatesToForm, type TaskDatesPatch } from "@/lib/cards/task-dates-form";

import {
  getCardRevision,
  patchBoardCardPreview,
  patchCardQueryData,
} from "../card-cache-utils";

interface UseCardMetadataActionsProps {
  data: CardWithList;
  boardId: string;
  queryClient: QueryClient;
  invalidateBoardCalendar: () => void;
  setIsDateOpen: (open: boolean) => void;
}

export const useCardMetadataActions = ({
  data,
  boardId,
  queryClient,
  invalidateBoardCalendar,
  setIsDateOpen,
}: UseCardMetadataActionsProps) => {
  const dateRequestRef = useRef<Partial<CardWithList> | null>(null);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      dateRequestRef.current = null;
      patchCardQueryData(queryClient, updatedCard.id, {
        startDate: updatedCard.startDate,
        dueDate: updatedCard.dueDate,
        deadlineOn: updatedCard.deadlineOn,
        scheduledOn: updatedCard.scheduledOn,
        scheduledStartAt: updatedCard.scheduledStartAt,
        scheduledEndAt: updatedCard.scheduledEndAt,
        isCompleted: updatedCard.isCompleted,
        reminder: updatedCard.reminder,
        reminderSetAt: updatedCard.reminderSetAt,
        updatedAt: updatedCard.updatedAt,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        startDate: updatedCard.startDate,
        dueDate: updatedCard.dueDate,
        deadlineOn: updatedCard.deadlineOn,
        scheduledOn: updatedCard.scheduledOn,
        scheduledStartAt: updatedCard.scheduledStartAt,
        scheduledEndAt: updatedCard.scheduledEndAt,
        isCompleted: updatedCard.isCompleted,
        reminder: updatedCard.reminder,
        reminderSetAt: updatedCard.reminderSetAt,
        updatedAt: updatedCard.updatedAt,
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
    onError: (error, errorCode) => {
      const request = dateRequestRef.current;
      if (request) {
        patchCardQueryData(queryClient, data.id, request);
        patchBoardCardPreview(boardId, data.id, request);
        dateRequestRef.current = null;
      }
      toast.error(error);

      if (errorCode === "CARD_CONFLICT") {
        void queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      }
    },
  });

  const revision = () => getCardRevision(queryClient, data.id, data.updatedAt);

  const submit = (changes: Partial<CardWithList>, input: Omit<UpdateCardInput, "id" | "boardId" | "expectedUpdatedAt">) => {
    if (isLoadingUpdate || dateRequestRef.current) {
      return;
    }

    // Snapshot đúng các trường sắp đổi để hoàn tác nếu server từ chối.
    dateRequestRef.current = Object.fromEntries(
      (Object.keys(changes) as (keyof CardWithList)[]).map((key) => [key, data[key]]),
    ) as Partial<CardWithList>;
    patchCardQueryData(queryClient, data.id, changes);
    patchBoardCardPreview(boardId, data.id, changes);
    executeUpdateCard({ id: data.id, boardId, expectedUpdatedAt: revision(), ...input });
  };

  const sameTime = (left: unknown, right: unknown) =>
    (left ? new Date(left as string).getTime() : null) === (right ? new Date(right as string).getTime() : null);

  /** Chỉ gửi trường thật sự đổi: tránh kích hoạt kiểm tra legacy hoặc đặt lại nhắc không cần. */
  const saveTaskDates = (patch: TaskDatesPatch) => {
    const stored = taskDatesToForm(data);
    const dueChanged = !sameTime(patch.dueDate, data.dueDate);
    const deadlineOnChanged = (patch.deadlineOn ?? "") !== (data.dueDate ? "" : stored.deadlineDate);
    const scheduleSignature = (on: unknown, start: unknown, end: unknown) =>
      [on ? String(on).slice(0, 10) : "", start ? new Date(start as string).getTime() : "", end ? new Date(end as string).getTime() : ""].join("|");
    const scheduleChanged =
      scheduleSignature(patch.scheduledOn, patch.scheduledStartAt, patch.scheduledEndAt) !==
      scheduleSignature(data.scheduledOn, data.scheduledStartAt, data.scheduledEndAt);
    const reminderChanged = patch.reminder !== (data.reminder || "none");
    const dateOnly = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

    if (!dueChanged && !deadlineOnChanged && !scheduleChanged && !reminderChanged) {
      setIsDateOpen(false);
      return;
    }

    submit(
      {
        ...(dueChanged || deadlineOnChanged ? { dueDate: patch.dueDate, deadlineOn: dateOnly(patch.deadlineOn) } : {}),
        ...(scheduleChanged
          ? {
            scheduledOn: dateOnly(patch.scheduledOn),
            scheduledStartAt: patch.scheduledStartAt ? new Date(patch.scheduledStartAt) : null,
            scheduledEndAt: patch.scheduledEndAt ? new Date(patch.scheduledEndAt) : null,
          }
          : {}),
        ...(reminderChanged ? { reminder: patch.reminder === "none" ? null : patch.reminder } : {}),
      },
      {
        ...(dueChanged || deadlineOnChanged
          ? {
            dueDate: patch.dueDate,
            deadlineOn: patch.deadlineOn,
            dueDateTimezoneOffset: patch.dueDate ? -7 * 60 : undefined,
          }
          : {}),
        ...(scheduleChanged
          ? {
            scheduledOn: patch.scheduledOn,
            scheduledStartAt: patch.scheduledStartAt,
            scheduledEndAt: patch.scheduledEndAt,
          }
          : {}),
        ...(reminderChanged || dueChanged || deadlineOnChanged ? { reminder: patch.reminder } : {}),
      },
    );
  };

  /** Bỏ lịch làm nhưng giữ hạn nộp. */
  const clearSchedule = () => submit(
    { scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null },
    { scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null },
  );

  const clearLegacyStart = () => submit({ startDate: null }, { startDate: null });

  const updateCompletion = (checked: boolean) => {
    executeUpdateCard({
      id: data.id,
      boardId,
      expectedUpdatedAt: revision(),
      isCompleted: checked,
    });
  };

  return {
    isLoadingUpdate,
    saveTaskDates,
    clearSchedule,
    clearLegacyStart,
    updateCompletion,
  };
};
