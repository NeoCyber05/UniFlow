import type { QueryClient } from "@tanstack/react-query";

import { getBoardCalendarQueryOptions } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_hooks/use-calendar-query";

import { viewQueryOptions } from "./use-view";

// Single source of the list view URL: the route and the prefetch must build the same query key.
export const boardListViewPath = (boardId: string, group: string | null) =>
  `/board/${boardId}/list${group === "list" ? "?group=list" : ""}`;

const PLAIN_VIEWS = new Set(["analytics", "graph", "split", "timeline"]);

/** Starts the view requests a route will make, so they run in parallel with layout views instead of after them. */
export const prefetchRouteViews = (queryClient: QueryClient, pathname: string, search: string) => {
  const match = pathname.match(/^\/board\/([^/]+)(?:\/([^/]+))?\/?$/);

  if (!match) return;

  const [, boardId, view] = match;
  const prefetch = (path: string) => void queryClient.prefetchQuery(viewQueryOptions(path));

  prefetch(`/board/${boardId}/layout`);

  if (!view) prefetch(`/board/${boardId}`);
  else if (view === "list") prefetch(boardListViewPath(boardId, new URLSearchParams(search).get("group")));
  else if (view === "calendar") {
    prefetch(`/board/${boardId}/calendar`);
    void queryClient.prefetchQuery(getBoardCalendarQueryOptions(boardId));
  } else if (PLAIN_VIEWS.has(view)) prefetch(`/board/${boardId}/${view}`);
};
