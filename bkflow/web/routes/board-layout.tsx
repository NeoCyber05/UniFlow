import { Suspense } from "react";
import { Navigate, Outlet, useParams } from "react-router";

import type { loadBoardLayout } from "@/server/views/board-layout";
import { BoardAssistant } from "@/components/ai-assistant/board-assistant";
import { BoardCoursesHydrator } from "@/components/courses/board-courses-hydrator";
import { CourseFilterBar } from "@/components/courses/course-filter-bar";
import { CourseFilterFromUrl } from "@/components/courses/course-filter-from-url";
import { ImportantFilterFromUrl } from "@/components/boards/important-filter-from-url";
import { BoardOrgControl } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-org-control";
import { BoardNavbar } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-navbar";
import { BoardShell } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-shell";

import { useTitle } from "../lib/use-title";
import { useView } from "../lib/use-view";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadBoardLayout>>;

export default function BoardLayoutRoute() {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const { data } = useView<View>(`/board/${boardId}/layout`);
  useTitle(data?.title ?? "Bảng");

  if (!data) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFoundRoute />;

  return (
    <div
      className="relative h-screen flex flex-col overflow-hidden bg-no-repeat bg-cover bg-center"
      style={{ backgroundImage: `url(${data.board.imageFullUrl})` }}
    >
      <BoardOrgControl orgId={data.boardOrgId} />
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
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      <BoardShell
        boardNavbar={
          <BoardNavbar
            data={data.board}
            organizationMembers={data.effectiveOrgMembers}
            currentUserId={data.currentUserId}
            currentMemberRole={data.currentMemberRole}
            semesters={data.semesters}
          />
        }
        courseFilterBar={
          data.isSemesterBoard ? (
            <CourseFilterBar boardId={boardId} canEdit={data.canEdit} />
          ) : undefined
        }
      >
        <Outlet />
      </BoardShell>

      <BoardAssistant boardId={boardId} />
    </div>
  );
}
