import { Suspense, useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

import type { loadBoardLayout } from "@/server/views/board-layout";
import { BoardAssistant } from "@/components/ai-assistant/board-assistant";
import { BoardCoursesHydrator } from "@/components/courses/board-courses-hydrator";
import { CourseFilterBar } from "@/components/courses/course-filter-bar";
import { CourseFilterFromUrl } from "@/components/courses/course-filter-from-url";
import { ImportantFilterFromUrl } from "@/components/boards/important-filter-from-url";
import { BoardNavbar } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-navbar";
import { BoardShell } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-shell";

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
  // Start content loading alongside the layout, before Outlet can mount.
  useEffect(() => {
    prefetchRouteViews(queryClient, pathname, search);
  }, [pathname, search, queryClient]);
  useTitle(data?.title ?? "Bảng");

  if (!data && error) return <div role="alert" className="px-6 pt-20 text-sm">Chưa tải được bảng. <button type="button" className="underline" onClick={() => void refetch()}>Thử lại</button></div>;
  if (!data) return <div className="pt-14" role="status" aria-label="Đang tải bảng"><Skeleton className="m-4 h-12" /><Skeleton className="m-4 h-96" /></div>;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFoundRoute />;

  return (
    <div
      className="relative h-screen flex flex-col overflow-hidden bg-no-repeat bg-cover bg-center"
      style={data.isSemesterBoard ? undefined : { backgroundImage: `url(${data.board.imageFullUrl})` }}
    >
      <BoardCoursesHydrator
        boardId={boardId}
        initialData={{ boardType: data.board.boardType, courses: data.courses }}
      />
      {data.isSemesterBoard && (
        <Suspense fallback={null}>
          <CourseFilterFromUrl boardId={boardId} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ImportantFilterFromUrl boardId={boardId} />
      </Suspense>
      {!data.isSemesterBoard && <div className="absolute inset-0 bg-black/10 pointer-events-none" />}

      <BoardShell
        boardNavbar={
          <BoardNavbar
            data={data.board}
            currentUserId={data.currentUserId}
            semesters={data.semesters}
            courseFilter={
              data.isSemesterBoard ? (
                <CourseFilterBar boardId={boardId} canEdit={data.canEdit} />
              ) : undefined
            }
          />
        }
      >
        <Outlet />
      </BoardShell>

      <BoardAssistant boardId={boardId} />
    </div>
  );
}
