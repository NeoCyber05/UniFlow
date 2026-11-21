import type { QueryClient } from "@tanstack/react-query";

import { calendarRangeQueryKey } from "./calendar/calendar-query-keys";
import { cardContextQueryKey, MY_TASK_COUNTS_KEY, MY_TASKS_ROOT_KEY } from "./my-tasks/types";

// Query roots no write changes; notifications arrive via Pusher/polling.
const UNRELATED_QUERY_ROOTS = new Set([
  "notifications",
  "workspace-search",
  "board-search",
  "capture-context",
  "ai-task-edits",
  "page-convert-deadlines",
]);

// Not shown while closed, so mark stale but refetch only when the dialog opens again.
const CARD_COPY_OPTIONS_ROOT = "card-copy-options";
const LAZY_QUERY_ROOTS = new Set([CARD_COPY_OPTIONS_ROOT]);

const root = (queryKey: readonly unknown[]) => String(queryKey[0]);

/** Shared by useAction and router.refresh(): refetch active data queries, skipping unrelated/lazy roots. */
export const invalidateAfterWrite = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({
    predicate: (query) => !UNRELATED_QUERY_ROOTS.has(root(query.queryKey)) && !LAZY_QUERY_ROOTS.has(root(query.queryKey)),
  });
  void queryClient.invalidateQueries({
    predicate: (query) => LAZY_QUERY_ROOTS.has(root(query.queryKey)),
    refetchType: "none",
  });
};

export const isBoardTaskListQuery = (queryKey: readonly unknown[], boardId: string) =>
  queryKey[0] === MY_TASKS_ROOT_KEY[0] &&
  (queryKey[1] === "todo" || queryKey[1] === "board") && queryKey[2] === boardId;

export const invalidateTaskWrite = (
  queryClient: QueryClient,
  boardId: string,
  { cardId, change = "card", counts = false, positions = false }: {
    cardId?: string | null;
    change?: "card" | "important" | "my-day" | "checklist-date";
    counts?: boolean;
    positions?: boolean;
  } = {},
) => {
  const boardPath = `/board/${boardId}`;
  const cardViews = new Set<string>();
  if (change !== "checklist-date") cardViews.add(boardPath);
  if (change === "card" || change === "important") {
    cardViews.add(`${boardPath}/graph`);
    cardViews.add(`${boardPath}/timeline`);
  }
  if (change === "card") cardViews.add(`${boardPath}/analytics`);
  const [calendarRoot, , rangeKey] = calendarRangeQueryKey(boardId);
  const [cardContextRoot] = cardContextQueryKey(cardId ?? "");
  if (positions) {
    void queryClient.invalidateQueries({ queryKey: [CARD_COPY_OPTIONS_ROOT], refetchType: "none" });
  }

  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const [root, id] = queryKey;
      if (root === "view") return typeof id === "string" && cardViews.has(id);
      if (root === calendarRoot) {
        return id === boardId && change !== "my-day" && (change !== "checklist-date" || queryKey[2] === rangeKey);
      }
      if (root === "card") return Boolean(cardId) && id === cardId;
      if (root === cardContextRoot) return change !== "checklist-date" && Boolean(cardId) && id === cardId;
      if (counts && root === MY_TASK_COUNTS_KEY[0] && id === MY_TASK_COUNTS_KEY[1]) return true;
      return change !== "checklist-date" && isBoardTaskListQuery(queryKey, boardId);
    },
  });
};
