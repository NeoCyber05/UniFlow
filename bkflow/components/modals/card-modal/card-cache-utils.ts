import type { QueryClient } from "@tanstack/react-query";

import type { CardWithAssignees, CardWithList } from "@/types";
import { useBoardStateActionsStore } from "@/hooks/use-board-state-actions-store";

type CardQueryClient = QueryClient;
type RefetchTimer = ReturnType<typeof setTimeout>;

const refetchTimersByClient = new WeakMap<CardQueryClient, Map<string, RefetchTimer>>();

export const patchCardQueryData = (
  queryClient: QueryClient,
  cardId: string,
  patch: Partial<CardWithList>,
) => {
  queryClient.setQueryData<CardWithList>(["card", cardId], (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      ...patch,
    };
  });
};

/**
 * Revision (Card.updatedAt, ISO) mới nhất client biết cho metadata CAS:
 * lấy mốc muộn nhất giữa cache chi tiết `["card", id]` và các nguồn dự phòng (state board/calendar...).
 */
export const getCardRevision = (
  queryClient: QueryClient,
  cardId: string,
  ...fallbacks: Array<Date | string | null | undefined>
): string | undefined => {
  const cached = queryClient.getQueryData<CardWithList>(["card", cardId])?.updatedAt;
  const times = [cached, ...fallbacks]
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((time) => !Number.isNaN(time));

  return times.length > 0 ? new Date(Math.max(...times)).toISOString() : undefined;
};

export const mergeCardAssignee = (
  assignees: CardWithList["assignees"],
  assignee: CardWithList["assignees"][number],
) => [
  ...assignees.filter((item) => item.boardMemberId !== assignee.boardMemberId),
  assignee,
];

export const removeCardAssignee = (
  assignees: CardWithList["assignees"],
  boardMemberId: string,
) => assignees.filter((item) => item.boardMemberId !== boardMemberId);

export const mergeCardLabel = (
  labels: CardWithList["labels"],
  cardLabel: CardWithList["labels"][number],
) => [
  ...labels.filter((item) => item.labelId !== cardLabel.labelId),
  cardLabel,
];

export const removeCardLabel = (
  labels: CardWithList["labels"],
  labelId: string,
) => labels.filter((item) => item.labelId !== labelId);

export const scheduleCoalescedCardRefetch = (
  queryClient: QueryClient,
  cardId: string,
  delay = 250,
) => {
  let timers = refetchTimersByClient.get(queryClient);

  if (!timers) {
    timers = new Map();
    refetchTimersByClient.set(queryClient, timers);
  }

  const existingTimer = timers.get(cardId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    timers?.delete(cardId);
    void queryClient.refetchQueries({
      queryKey: ["card", cardId],
      type: "active",
    });
  }, delay);

  timers.set(cardId, timer);
};

export const patchBoardCardPreview = (
  boardId: string,
  cardId: string,
  patch: Partial<CardWithAssignees>,
) => {
  useBoardStateActionsStore.getState().getBoardActions(boardId)?.patchCard(cardId, patch);
};

export const patchBoardCardCount = (
  boardId: string,
  cardId: string,
  countKey: "comments" | "attachments",
  delta: number,
) => {
  useBoardStateActionsStore.getState().getBoardActions(boardId)?.patchCardCount(
    cardId,
    countKey,
    delta,
  );
};
