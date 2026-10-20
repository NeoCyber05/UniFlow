import type { QueryClient } from "@tanstack/react-query";

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
const LAZY_QUERY_ROOTS = new Set(["card-copy-options"]);

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
