import { Navigate, useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { getPersonalBoardDestination } from "@/lib/my-tasks/personal-navigation";
import { MY_TASKS_CONTEXT_KEY, type MyTasksContext } from "@/lib/my-tasks/types";
import { tr } from "@/lib/i18n";

import type { loadMy } from "@/server/views/my";
import { NoWorkspaceState } from "@/components/my-tasks/no-workspace-state";
import { MyTasksView } from "@/components/my-tasks/my-tasks-view";
import { SidebarShell } from "@/app/(platform)/(dashboard)/_components/sidebar-shell";
import { ViewSkeleton } from "@/components/view-skeleton";

import { myViewPath } from "../lib/prefetch-route";
import { useTitle } from "../lib/use-title";
import { useView } from "../lib/use-view";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadMy>>;

// my/layout.tsx (SidebarShell) + my/[view]/page.tsx.
export default function MyRoute() {
  const { view = "" } = useParams<{ view: string }>();
  const error = useSearchParams()[0].get("error") ?? undefined;
  // Board views only redirect; skip the server round-trip when the sidebar already knows the board.
  const cachedBoardId = useQueryClient().getQueryData<MyTasksContext>(MY_TASKS_CONTEXT_KEY)?.board?.id;
  const fastRedirect = !error && cachedBoardId ? getPersonalBoardDestination(view, cachedBoardId) : null;
  const { data } = useView<View>(myViewPath(view, error), { enabled: !fastRedirect });
  useTitle(tr("route.titlePersonalSpace"));

  if (fastRedirect) return <Navigate to={fastRedirect} replace />;
  return <SidebarShell>{render(data)}</SidebarShell>;
}

const render = (data: View | undefined) => {
  if (!data) return <ViewSkeleton variant="rows" className="p-0" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFoundRoute />;
  if (!data.context) return <NoWorkspaceState />;

  return (
    <MyTasksView
      key={data.boardId}
      initialContext={data.context}
      initialData={data.data}
      initialNow={data.now}
      canEdit={data.canEdit}
      error={data.error}
    />
  );
};
