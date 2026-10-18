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
  Settings2,
  Sun,
  CalendarDays,
  ListTodo,
  BookOpen,
  FileText,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManageSemestersDialog } from "@/components/semesters/manage-semesters-dialog";
import { useMyTaskCounts, useMyTasksContext } from "@/hooks/use-my-tasks";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { getCourseColor } from "@/lib/courses/course-colors";
import { MY_TASKS_CONTEXT_KEY } from "@/lib/my-tasks/types";
import { formatSemesterLabel } from "@/lib/semesters";
import { cn } from "@/lib/utils";

const EMPTY_COURSE_IDS: string[] = [];

const itemClassName = (isActive: boolean) =>
  cn(
    "flex w-full items-center gap-x-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500",
    isActive && "bg-violet-50 font-medium text-violet-700 hover:bg-violet-50",
  );

const Count = ({ value }: { value: number | undefined }) =>
  value ? (
    <span className="ml-auto rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
      {value}
    </span>
  ) : null;

export const MySidebarNav = () => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: context } = useMyTasksContext();
  const { data: counts } = useMyTaskCounts();
  const [manageOpen, setManageOpen] = useState(false);

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
  const isSemesterBoardActive =
    (isAtSemesterBoard && selectedCourseIds.length === 0) ||
    (context?.currentSemesterId ? pathname === `/semester/${context.currentSemesterId}` : false);

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
    <div className="space-y-4 pt-2">
      <nav aria-label="Không gian học tập" className="space-y-1">
        {[
          { href: "/my/today", label: "Hôm nay", icon: Sun },
          { href: "/my/calendar", label: "Lịch của mình", icon: CalendarDays },
          { href: "/my/tasks", label: "Công việc", icon: ListTodo },
          { href: "/my/courses", label: "Học phần", icon: BookOpen },
          { href: "/pages", label: "Trang của tôi", icon: FileText },
        ].map(item => <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
          className={itemClassName(pathname === item.href)}
          onClick={() => {
            if (boardId && ["/my/tasks", "/my/calendar"].includes(item.href)) useBoardFilters.getState().clearFilters(boardId);
          }}
        ><item.icon aria-hidden="true" className="h-4 w-4" />{item.label}{item.href === "/my/today" && <Count value={counts?.today} />}</Link>)}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md border-t border-border px-3 py-3 text-xs font-medium text-muted-foreground hover:bg-muted">
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
        <Link href={semesterBoardHref} className={itemClassName(isSemesterBoardActive)}>
          <GraduationCap className="h-4 w-4" />
          Bảng học kỳ
          <Count value={counts?.today} />
        </Link>
      )}

      {context?.courses && context.courses.length > 0 && (
        <div className="space-y-0.5">
          <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Môn học</p>
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
        {context?.personalOrgId && (
          <Link
            href={`/organization/${context.personalOrgId}/activity`}
            className={itemClassName(pathname === `/organization/${context.personalOrgId}/activity`)}
          >
            <Activity className="h-4 w-4" />
            Nhật ký hoạt động
          </Link>
        )}
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
