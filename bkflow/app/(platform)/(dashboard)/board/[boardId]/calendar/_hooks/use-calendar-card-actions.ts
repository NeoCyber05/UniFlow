"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type { AppRouterInstance } from "@/web/shims/next-navigation";
import { toast } from "sonner";

import { setChecklistItemDueDate } from "@/actions/checklists/set-checklist-item-due-date";
import type { InputType as SetChecklistItemDueDateInput } from "@/actions/checklists/set-checklist-item-due-date/types";
import { updateCard } from "@/actions/cards/update-card";
import type { InputType as UpdateCardInput } from "@/actions/cards/update-card/types";
import { useAction } from "@/hooks/use-action";
import { runCalendarAction } from "@/lib/calendar/calendar-action";
import { buildSchedulePatch, type ScheduleIntent } from "@/lib/calendar/schedule-command";
import { getCardRevision } from "@/components/modals/card-modal/card-cache-utils";
import type { BoardCalendarCardItem, BoardCalendarResponse } from "@/types";

type UseCalendarCardActionsOptions = {
  query: UseQueryResult<BoardCalendarResponse>;
  queryClient: QueryClient;
  router: AppRouterInstance;
  invalidateBoardCalendar: () => void;
  setExpandedDayKey: (dayKey: string | null) => void;
  onUpdateComplete: () => void;
  onChecklistComplete: () => void;
  /** Thả vào giờ khi chưa biết thời lượng: UI hỏi giờ kết thúc, không tự đặt 30/60 phút. */
  onUpdateSuccess: () => void;
  onNeedsEnd: (draft: { cardId: string; startsAt: string }) => void;
};

type QueuedUpdate = {
  input: UpdateCardInput;
};

export const useCalendarCardActions = ({
  query,
  queryClient,
  router,
  invalidateBoardCalendar,
  setExpandedDayKey,
  onUpdateComplete,
  onChecklistComplete,
  onNeedsEnd,
  onUpdateSuccess,
}: UseCalendarCardActionsOptions) => {
  const updateSuccessToastRef = useRef<string | null>(null);
  const updatingChecklistItemCardIdRef = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queueRef = useRef<QueuedUpdate[]>([]);
  const inFlightRef = useRef<QueuedUpdate | null>(null);

  const latestRevision = useCallback((cardId: string) => {
    const responses = queryClient
      .getQueriesData<BoardCalendarResponse>({ queryKey: ["board-calendar", query.data?.boardId] })
      .map(([, response]) => response);
    const times = responses.flatMap((response) => [
      ...(response?.items ?? []).flatMap((item) => (item.type === "card" && item.cardId === cardId ? [item.updatedAt] : [])),
      ...(response?.unscheduledCards ?? []).flatMap((card) => (card.cardId === cardId ? [card.updatedAt] : [])),
    ]);

    return getCardRevision(queryClient, cardId, ...times);
  }, [query.data?.boardId, queryClient]);

  // Bước kế trong hàng đợi chạy sau khi request trước kết thúc để revision luôn mới nhất.
  const dispatchNextRef = useRef<() => void>(() => undefined);

  const { execute: executeUpdateCard, isLoading: isUpdatingCardDate } = useAction((input: UpdateCardInput) => runCalendarAction(() => updateCard(input)), {
    onSuccess: (data) => {
      if (updateSuccessToastRef.current) toast.success(updateSuccessToastRef.current);
      updateSuccessToastRef.current = null;
      setSaveError(null);
      onUpdateSuccess();
      // Cập nhật revision ngay để thao tác kế tiếp không dùng mốc cũ trước khi refetch.
      queryClient.setQueriesData<BoardCalendarResponse>(
        { queryKey: ["board-calendar", query.data?.boardId] },
        (current) => current && {
          ...current,
          items: current.items.map((item) =>
            item.type === "card" && item.cardId === data.id
              ? { ...item, scheduledOn: data.scheduledOn?.toISOString().slice(0, 10) ?? null, scheduledStartAt: data.scheduledStartAt?.toISOString() ?? null, scheduledEndAt: data.scheduledEndAt?.toISOString() ?? null, isCompleted: data.isCompleted, updatedAt: new Date(data.updatedAt).toISOString() }
              : item
          ),
        },
      );
      setExpandedDayKey(null);
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
    },
    onError: (error) => {
      updateSuccessToastRef.current = null;
      setSaveError(error);
      const failed = inFlightRef.current;
      if (failed) queueRef.current = queueRef.current.filter((entry) => entry.input.id !== failed.input.id);
      toast.error(error);
      invalidateBoardCalendar();
      void query.refetch();
    },
    onComplete: () => {
      inFlightRef.current = null;
      onUpdateComplete();
      dispatchNextRef.current();
    },
  });

  useEffect(() => {
    dispatchNextRef.current = () => {
      if (inFlightRef.current) return;
      const next = queueRef.current.shift();
      if (!next) return;

      inFlightRef.current = next;
      executeUpdateCard({
        ...next.input,
        expectedUpdatedAt: next.input.expectedUpdatedAt ?? latestRevision(next.input.id),
      });
    };
  });

  const {
    execute: executeSetChecklistItemDueDate,
    isLoading: isUpdatingChecklistItemDueDate,
  } = useAction(setChecklistItemDueDate, {
    onSuccess: () => {
      const cardId = updatingChecklistItemCardIdRef.current;

      setExpandedDayKey(null);
      invalidateBoardCalendar();

      if (cardId) {
        queryClient.invalidateQueries({ queryKey: ["card", cardId] });
        queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      }

      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
      invalidateBoardCalendar();
    },
    onComplete: () => {
      updatingChecklistItemCardIdRef.current = null;
      onChecklistComplete();
    },
  });

  const setUpdateSuccessToast = useCallback((message: string | null) => {
    updateSuccessToastRef.current = message;
  }, []);

  const setUpdatingChecklistItemCardId = useCallback((cardId: string | null) => {
    updatingChecklistItemCardIdRef.current = cardId;
  }, []);

  return {
    executeUpdateCard: ((rawInput: UpdateCardInput) => {
      setSaveError(null);
      queueRef.current.push({ input: rawInput });
      dispatchNextRef.current();
    }) as (input: UpdateCardInput) => void,
    scheduleCard: (cardId: string, intent: ScheduleIntent, successMessage?: string) => {
      const card = query.data?.items.find(
        (item): item is BoardCalendarCardItem => item.type === "card" && item.cardId === cardId,
      );
      const patch = buildSchedulePatch(
        {
          scheduledOn: card?.scheduledOn ?? null,
          scheduledStartAt: card?.scheduledStartAt ?? null,
          scheduledEndAt: card?.scheduledEndAt ?? null,
        },
        intent,
      );

      if (!patch) {
        toast.error("Khoảng thời gian không hợp lệ: giờ kết thúc phải sau giờ bắt đầu.");
        onUpdateComplete();
        return;
      }
      if ("needsEnd" in patch) {
        onNeedsEnd({ cardId, startsAt: patch.startsAt });
        onUpdateComplete();
        return;
      }

      updateSuccessToastRef.current = successMessage ?? null;
      const input: UpdateCardInput = { id: cardId, boardId: query.data?.boardId ?? "", ...patch };
      setSaveError(null);
      queueRef.current.push({ input });
      dispatchNextRef.current();
    },
    executeSetChecklistItemDueDate:
      executeSetChecklistItemDueDate as (input: SetChecklistItemDueDateInput) => void,
    saveError,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    setUpdateSuccessToast,
    setUpdatingChecklistItemCardId,
  };
};
