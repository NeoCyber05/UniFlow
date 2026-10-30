import type { ComponentType } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { getBoardCalendarQueryOptions } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_hooks/use-calendar-query";

import { MY_TASKS_CONTEXT_KEY } from "@/lib/my-tasks/types";

import { viewQueryOptions } from "./use-view";

// Single source of the list view URL: the route and the prefetch must build the same query key.
export const boardListViewPath = (boardId: string, group: string | null) =>
  `/board/${boardId}/list${group === "list" ? "?group=list" : ""}`;

export const myViewPath = (view: string, error: string | null | undefined) =>
  `/my/${view}${error ? `?error=${encodeURIComponent(error)}` : ""}`;

const PLAIN_VIEWS = new Set(["analytics", "graph", "timeline"]);

export type RouteLoader = { (): Promise<{ default: ComponentType }>; loaded?: ComponentType };

/** import() that keeps the component once loaded, so the router can render a preloaded tab without suspending. */
const routeLoader = (load: () => Promise<{ default: ComponentType }>): RouteLoader => {
  const loader: RouteLoader = () =>
    load().then((module) => {
      loader.loaded = module.default;
      return module;
    });
  return loader;
};

// Lazy board tabs: the router renders these and the sidebar preloads them, so a chunk is fetched once.
export const boardTabRoutes = {
  kanban: routeLoader(() => import("../routes/board-kanban")),
  calendar: routeLoader(() => import("../routes/board-calendar")),
  timeline: routeLoader(() => import("../routes/board-timeline")),
  graph: routeLoader(() => import("../routes/board-graph")),
  analytics: routeLoader(() => import("../routes/board-analytics")),
  todo: routeLoader(() => import("../routes/board-todo")),
};

/** Starts downloading the code of a board tab, so opening it does not wait for (or blank on) its chunk. */
export const preloadRouteCode = (pathname: string) => {
  const match = pathname.match(/^\/board\/[^/]+(?:\/([^/?#]+))?\/?(?:[?#]|$)/);
  const view = match?.[1] ?? "kanban";
  // hasOwnProperty: paths like /board/x/constructor must not reach Object.prototype (Object.hasOwn needs Safari 15.4).
  if (!match || !Object.prototype.hasOwnProperty.call(boardTabRoutes, view)) return;
  // A failed preload is retried by the route itself on navigation.
  void boardTabRoutes[view as keyof typeof boardTabRoutes]().catch(() => {});
};

/** Preloads tab code once the browser is idle; skipped when the user asked to save data. */
export const preloadRouteCodeWhenIdle = (paths: string[]) => {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return () => {};
  const run = () => paths.forEach(preloadRouteCode);
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 1500);
  return () => clearTimeout(id);
};

/** Starts the view requests a route will make, so they run in parallel with layout views instead of after them. */
export const prefetchRouteViews = (queryClient: QueryClient, pathname: string, search: string) => {
  const my = pathname.match(/^\/my\/([^/]+)\/?$/);
  // With a cached context MyRoute redirects on the client and never requests the view.
  if (my && !queryClient.getQueryData(MY_TASKS_CONTEXT_KEY)) {
    void queryClient.prefetchQuery(viewQueryOptions(myViewPath(my[1], new URLSearchParams(search).get("error"))));
  }

  const match = pathname.match(/^\/board\/([^/]+)(?:\/([^/]+))?\/?$/);

  if (!match) return;

  const [, boardId, view] = match;
  const prefetch = (path: string) => void queryClient.prefetchQuery(viewQueryOptions(path));

  preloadRouteCode(pathname);

  prefetch(`/board/${boardId}/layout`);

  if (!view) prefetch(`/board/${boardId}`);
  else if (view === "list") prefetch(boardListViewPath(boardId, new URLSearchParams(search).get("group")));
  else if (view === "calendar") {
    prefetch(`/board/${boardId}/calendar`);
    void queryClient.prefetchQuery(getBoardCalendarQueryOptions(boardId));
  } else if (PLAIN_VIEWS.has(view)) prefetch(`/board/${boardId}/${view}`);
};
