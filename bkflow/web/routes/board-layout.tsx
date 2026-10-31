import { Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { skeletonForPath, ViewSkeleton } from "@/components/view-skeleton";

import type { loadBoardLayout } from "@/server/views/board-layout";
import { BoardAssistant } from "@/components/ai-assistant/board-assistant";
import { BoardCoursesHydrator } from "@/components/courses/board-courses-hydrator";
import { CourseFilterBar } from "@/components/courses/course-filter-bar";
import { CourseFilterFromUrl } from "@/components/courses/course-filter-from-url";
import { ImportantFilterFromUrl } from "@/components/boards/important-filter-from-url";
import { BoardNavbar } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-navbar";
import { BoardShell } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-shell";
import { tr } from "@/lib/i18n";
import { formatWorkspaceTitle } from "@/lib/workspaces";

import { useTitle } from "../lib/use-title";
import { prefetchRouteViews } from "../lib/prefetch-route";
import { useView } from "../lib/use-view";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadBoardLayout>>;

export default function BoardLayoutRoute() {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const { data, error, refetch } = useView<View>(`/board/${boardId}/layout`);
  const queryClient = useQueryClient();
  const { pathname, search } = useLocation();
  const [firstPathname] = useState(pathname);
  const [switchedView, setSwitchedView] = useState(false);
  if (!switchedView && pathname !== firstPathname) setSwitchedView(true);
  // Trang Việc cần làm không có thanh bảng; bộ lọc được đặt ngay trong trang
  const isListRoute = pathname.endsWith("/list");
  // Lịch / Sơ đồ / Thống kê dùng thanh lọc sáng, không nền tối
  const navTone = ["/calendar", "/graph", "/analytics"].some((tab) => pathname.endsWith(tab)) ? "light" : "dark";
  // Start content loading alongside the layout, before Outlet can mount.
  useEffect(() => {
    prefetchRouteViews(queryClient, pathname, search);
  }, [pathname, search, queryClient]);
  useTitle(data?.title ? formatWorkspaceTitle(data.title) : tr("route.titleBoard"));

  if (!data && error) return <div role="alert" className="px-6 pt-20 text-sm">{tr("route.boardLoadError")} <button type="button" className="underline" onClick={() => void refetch()}>{tr("route.retry")}</button></div>;
  if (!data) return <div className="h-screen pt-14"><ViewSkeleton variant={skeletonForPath(pathname)} label={tr("route.boardLoading")} /></div>;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFoundRoute />;

  return (
    <div
      className="relative h-screen flex flex-col overflow-hidden bg-no-repeat bg-cover bg-center"
      style={data.isWorkspaceBoard ? undefined : { backgroundImage: `url(${data.board.imageFullUrl})` }}
    >
      <BoardCoursesHydrator
        boardId={boardId}
        initialData={{ boardType: data.board.boardType, courses: data.courses }}
      />
      {data.isWorkspaceBoard && (
        <Suspense fallback={null}>
          <CourseFilterFromUrl boardId={boardId} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ImportantFilterFromUrl boardId={boardId} />
      </Suspense>
      {!data.isWorkspaceBoard && <div className="absolute inset-0 bg-black/10 pointer-events-none" />}

      <BoardShell
        boardNavbar={isListRoute ? null : (
          <BoardNavbar
            data={data.board}
            currentUserId={data.currentUserId}
            workspace={data.board.workspace}
            tone={navTone}
            courseFilter={
              data.isWorkspaceBoard ? (
                <CourseFilterBar boardId={boardId} canEdit={data.canEdit} tone={navTone} />
              ) : undefined
            }
          />
        )}
      >
        {/* Fades in on a tab or board switch, not on the board's first paint: its skeleton is already up there. */}
        <div key={pathname} className={switchedView ? "h-full view-enter" : "h-full"}>
          <Outlet />
        </div>
      </BoardShell>

      <BoardAssistant boardId={boardId} />
    </div>
  );
}
