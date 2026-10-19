"use client";

import { useMemo, useState } from "react";
import Link from "@/web/shims/next-link";
import { usePathname } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Semester } from "@prisma/client";
import {
  Activity,
  ChevronDown,
  GraduationCap,
  Trash2,
  Settings2,
  CalendarDays,
  ListTodo,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManageSemestersDialog } from "@/components/semesters/manage-semesters-dialog";
import { TrashDialog } from "@/components/notes/page-actions";
import { useMyTaskCounts, useMyTasksContext } from "@/hooks/use-my-tasks";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { getCourseColor } from "@/lib/courses/course-colors";
import { MY_TASKS_CONTEXT_KEY } from "@/lib/my-tasks/types";
import { formatSemesterLabel } from "@/lib/semesters";
import { cn } from "@/lib/utils";
import { viewQueryOptions } from "@/web/lib/use-view";

const EMPTY_COURSE_IDS: string[] = [];

const itemClassName = (isActive: boolean) =>
  cn(
    "flex h-8 w-full items-center gap-x-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
  );

const Count = ({ value }: { value: number | undefined }) =>
  value ? (
    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {value}
    </span>
  ) : null;

export const MySidebarNav = () => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: context } = useMyTasksContext();
  const { data: counts } = useMyTaskCounts();
  const [manageOpen, setManageOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const semesters = useMemo<Semester[]>(
    () =>
      (context?.semesters ?? []).map((semester) => ({
        ...semester,
        startDate: new Date(semester.startDate),
        endDate: new Date(semester.endDate),
        createdAt: new Date(semester.createdAt),
        updatedAt: new Date(semester.updatedAt),
      })),
    [context?.semesters],
  );
  const currentSemester = semesters.find((semester) => semester.id === context?.currentSemesterId);
  const board = context?.board ?? null;
  const boardId = board?.id;
  const selectedCourseIds = useBoardFilters((state) =>
    boardId ? state.filtersByBoardId[boardId]?.selectedCourseIds ?? EMPTY_COURSE_IDS : EMPTY_COURSE_IDS
  );
  const isAtSemesterBoard = board ? pathname.startsWith(`/board/${board.id}`) : false;
  const calendarHref = board ? `/board/${board.id}/calendar` : null;
  const isCalendarActive = calendarHref !== null && pathname === calendarHref;
  const isSemesterBoardActive =
    (isAtSemesterBoard && !isCalendarActive && selectedCourseIds.length === 0) ||
    (context?.currentSemesterId ? pathname === `/semester/${context.currentSemesterId}` : false);
  const clearBoardFilters = () => { if (boardId) useBoardFilters.getState().clearFilters(boardId); };
  const prefetchBoard = (view: "list" | "calendar") => {
    if (!boardId) return;
    void queryClient.prefetchQuery(viewQueryOptions(`/board/${boardId}/layout`));
    void queryClient.prefetchQuery(viewQueryOptions(`/board/${boardId}/${view}`));
  };

  const courseHref = (courseKey: string) =>
    board
      ? `/board/${board.id}?course=${courseKey}`
      : context?.currentSemesterId
        ? `/semester/${context.currentSemesterId}`
        : "#";

  const semesterBoardHref = board
    ? `/board/${board.id}/list`
    : context?.currentSemesterId
      ? `/semester/${context.currentSemesterId}`
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-7 w-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted">
          <GraduationCap className="h-3.5 w-3.5" />
          {currentSemester ? formatSemesterLabel(currentSemester.title) : "Chọn học kỳ"}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {semesters.map((semester) => (
            <DropdownMenuItem key={semester.id} asChild>
              <Link href={`/semester/${semester.id}`} className="flex items-center justify-between">
                {formatSemesterLabel(semester.title)}
                {semester.id === context?.currentSemesterId && (
                  <span className="text-[10px] font-semibold text-violet-600">Hiện tại</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            Quản lý học kỳ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {semesterBoardHref && (
        <Link href={semesterBoardHref} onMouseEnter={() => prefetchBoard("list")} onFocus={() => prefetchBoard("list")} onClick={clearBoardFilters} aria-current={isSemesterBoardActive ? "page" : undefined} className={itemClassName(isSemesterBoardActive)}>
          <ListTodo className="h-4 w-4" />
          Việc cần làm
          <Count value={counts?.today} />
        </Link>
      )}
      {calendarHref && (
        <Link href={calendarHref} onMouseEnter={() => prefetchBoard("calendar")} onFocus={() => prefetchBoard("calendar")} onClick={clearBoardFilters} aria-current={isCalendarActive ? "page" : undefined} className={itemClassName(isCalendarActive)}>
          <CalendarDays className="h-4 w-4" />
          Lịch
        </Link>
      )}
      </div>

      {context?.courses && context.courses.length > 0 && (
        <div className="space-y-0.5">
          <p className="flex h-7 items-center px-2.5 text-xs font-medium text-muted-foreground">Môn học</p>
          {context.courses.map((course) => {
            const isCourseActive =
              isAtSemesterBoard &&
              selectedCourseIds.length === 1 &&
              selectedCourseIds[0] === course.id;

            return (
              <Link key={course.id} href={courseHref(course.id)} className={itemClassName(isCourseActive)}>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", getCourseColor(course.color).dot)} />
                <span className="truncate">{course.name}</span>
                <Count value={counts?.byCourse[course.id]} />
              </Link>
            );
          })}
          {(() => {
            const isPersonalActive =
              isAtSemesterBoard &&
              selectedCourseIds.length === 1 &&
              selectedCourseIds[0] === PERSONAL_COURSE_FILTER;

            return (
              <Link href={courseHref(PERSONAL_COURSE_FILTER)} className={itemClassName(isPersonalActive)}>
                <span className="h-2 w-2 shrink-0 rounded-full border border-neutral-400" />
                Cá nhân
                <Count value={counts?.byCourse[PERSONAL_COURSE_FILTER]} />
              </Link>
            );
          })()}
        </div>
      )}

      <div className="space-y-0.5">
        <Link href="/settings/appearance" className={itemClassName(pathname === "/settings/appearance")}>
          <Settings2 aria-hidden="true" className="h-4 w-4" />Cài đặt → Giao diện
        </Link>
        {context?.personalOrgId && (
          <Link
            href={`/organization/${context.personalOrgId}/activity`}
            className={itemClassName(pathname === `/organization/${context.personalOrgId}/activity`)}
          >
            <Activity className="h-4 w-4" />
            Nhật ký hoạt động
          </Link>
        )}
        <button type="button" onClick={() => setTrashOpen(true)} className={itemClassName(false)}>
          <Trash2 className="h-4 w-4" />
          Thùng rác
        </button>
        <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
      </div>

      <ManageSemestersDialog
        open={manageOpen}
        onOpenChange={(open) => {
          setManageOpen(open);
          if (!open) void queryClient.invalidateQueries({ queryKey: MY_TASKS_CONTEXT_KEY });
        }}
        semesters={semesters}
      />
    </div>
  );
};
