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
import { calendarRangeQueryKey, calendarUnscheduledQueryKey } from "@/lib/calendar/calendar-query-keys";
import { applyCalendarPatchToCache } from "@/lib/calendar/optimistic-card-patch";
import { tr } from "@/lib/i18n";
import { buildSchedulePatch, type ScheduleIntent } from "@/lib/calendar/schedule-command";
import { getCardRevision } from "@/components/modals/card-modal/card-cache-utils";
import type { BoardCalendarCardItem, BoardCalendarResponse, BoardCalendarUnscheduledCard } from "@/types";

type UseCalendarCardActionsOptions = {
  boardId: string;
  query: UseQueryResult<BoardCalendarResponse>;
  queryClient: QueryClient;
  router: AppRouterInstance;
  invalidateBoardCalendar: () => void;
  setExpandedDayKey: (dayKey: string | null) => void;
  onUpdateComplete: () => void;
  onChecklistComplete: () => void;
  /** Thả vào giờ khi chưa biết thời lượng: UI hỏi giờ kết thúc, không tự đặt 30/60 phút. */
  onUpdateSuccess: (update: { cardId: string; updatedAt: string }) => void;
  onNeedsEnd: (draft: { cardId: string; startsAt: string }) => void;
};

type QueuedUpdate = {
  input: UpdateCardInput;
  previousRevision?: string;
};

export const useCalendarCardActions = ({
  boardId,
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
    const times = queryClient
      .getQueriesData<BoardCalendarResponse>({ queryKey: calendarRangeQueryKey(boardId) })
      .flatMap(([, response]) =>
        (response?.items ?? []).flatMap((item) =>
          item.type === "card" && item.cardId === cardId ? [item.updatedAt] : [],
        ),
      );
    const trayRevision = queryClient
      .getQueryData<BoardCalendarUnscheduledCard[]>(calendarUnscheduledQueryKey(boardId))
      ?.find((card) => card.cardId === cardId)?.updatedAt;

    return getCardRevision(queryClient, cardId, ...times, trayRevision);
  }, [boardId, queryClient]);

  // Dời thẻ ngay trên cache như Việc cần làm; lỗi thì onError refetch để hoàn tác.
  const patchCalendarCache = useCallback((input: UpdateCardInput) => {
    const patch: Partial<BoardCalendarCardItem> = {
      ...(input.startDate !== undefined ? { startDate: input.startDate?.toISOString() ?? null } : {}),
      // Hạn có giờ và hạn chỉ-ngày loại trừ nhau (giống card-update-service).
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate?.toISOString() ?? null, ...(input.dueDate ? { deadlineOn: null } : {}) } : {}),
      ...(input.deadlineOn !== undefined ? { deadlineOn: input.deadlineOn, ...(input.deadlineOn ? { dueDate: null } : {}) } : {}),
      ...(input.scheduledOn !== undefined ? { scheduledOn: input.scheduledOn } : {}),
      ...(input.scheduledStartAt !== undefined ? { scheduledStartAt: input.scheduledStartAt } : {}),
      ...(input.scheduledEndAt !== undefined ? { scheduledEndAt: input.scheduledEndAt } : {}),
      ...(input.isCompleted !== undefined ? { isCompleted: input.isCompleted } : {}),
    };

    void queryClient.cancelQueries({ queryKey: ["board-calendar", boardId] });
    applyCalendarPatchToCache(queryClient, boardId, input.id, patch);
  }, [boardId, queryClient]);

  // Bước kế trong hàng đợi chạy sau khi request trước kết thúc để revision luôn mới nhất.
  const dispatchNextRef = useRef<() => void>(() => undefined);

  const { execute: executeUpdateCard, isLoading: isUpdatingCardDate } = useAction((input: UpdateCardInput) => runCalendarAction(() => updateCard(input)), {
    onSuccess: (data) => {
      if (updateSuccessToastRef.current) toast.success(updateSuccessToastRef.current);
      updateSuccessToastRef.current = null;
      setSaveError(null);
      const updatedAt = new Date(data.updatedAt).toISOString();
      onUpdateSuccess({ cardId: data.id, updatedAt });
      // Cập nhật revision ngay để thao tác kế tiếp không dùng mốc cũ trước khi refetch.
      applyCalendarPatchToCache(queryClient, boardId, data.id, {
        scheduledOn: data.scheduledOn?.toISOString().slice(0, 10) ?? null,
        scheduledStartAt: data.scheduledStartAt?.toISOString() ?? null,
        scheduledEndAt: data.scheduledEndAt?.toISOString() ?? null,
        isCompleted: data.isCompleted,
        updatedAt,
      });
      // useAction gọi invalidateAfterWrite ngay sau onSuccess, đã gồm lịch, Công việc và thẻ này.
      setExpandedDayKey(null);
    },
    onError: (error) => {
      updateSuccessToastRef.current = null;
      setSaveError(error);
      const failed = inFlightRef.current;
      if (failed) queueRef.current = queueRef.current.filter((entry) => entry.input.id !== failed.input.id);
      toast.error(error);
      invalidateBoardCalendar();
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
        expectedUpdatedAt: next.input.expectedUpdatedAt ?? getCardRevision(
          queryClient, next.input.id, next.previousRevision, latestRevision(next.input.id),
        ),
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

  const queueUpdate = (input: UpdateCardInput) => {
    const previousRevision = latestRevision(input.id);
    setSaveError(null);
    patchCalendarCache(input);
    queueRef.current.push({ input, previousRevision });
    dispatchNextRef.current();
  };

  return {
    executeUpdateCard: queueUpdate,
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
        toast.error(tr("calendar.toast.invalidTimeRange"));
        onUpdateComplete();
        return;
      }
      if ("needsEnd" in patch) {
        onNeedsEnd({ cardId, startsAt: patch.startsAt });
        onUpdateComplete();
        return;
      }

      updateSuccessToastRef.current = successMessage ?? null;
      queueUpdate({ id: cardId, boardId, ...patch });
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
