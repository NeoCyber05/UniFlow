"use client";

import { BoardMember } from "@/types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Label, List } from "@prisma/client";
import { AlertCircle, ListTodo, Plus } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { BoardFilters } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-filters";
import { BoardImportantToggle } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/board-important-toggle";
import { CourseFilterBar } from "@/components/courses/course-filter-bar";
import { QuickAddBar, type QuickAddDefaults } from "@/components/my-tasks/quick-add-bar";
import { TaskDetailPanel } from "@/components/my-tasks/task-detail-panel";
import { TaskGroupSection } from "@/components/my-tasks/task-group-section";
import { TodoInsights } from "@/components/my-tasks/todo-insights";
import { useBoardCourses } from "@/hooks/use-board-courses";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { useTodoTasks } from "@/hooks/use-my-tasks";
import { useTaskPanelParam } from "@/hooks/use-task-panel-param";
import { filterableCardMatchesBoardFilters, PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { getListStatus } from "@/lib/boards/list-status";
import { fetcher } from "@/lib/fetcher";
import { todoTaskMatchesFilters } from "@/lib/my-tasks/todo-filters";
import {
  boardTasksQueryKey,
  type MyTask,
  type MyTaskGroup,
  type TaskListResponse,
} from "@/lib/my-tasks/types";
import { cn } from "@/lib/utils";

const TODO_GROUPS_STORAGE_KEY = "uniflow:todo-groups";

const formatToday = () =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

type ListGroupMode = "agenda" | "list";

type BoardListViewProps = {
  boardId: string;
  boardOrgId: string;
  isTeamBoard: boolean;
  canEdit: boolean;
  currentBoardMemberId?: string;
  /** Thành viên có thể được giao (không gồm VIEWER) — cho cú pháp +tên */
  assignableMembers: { userId: string; userName: string }[];
  lists: Pick<List, "id" | "title">[];
  members: Pick<BoardMember, "id" | "userName" | "userEmail" | "role">[];
  labels: Pick<Label, "id" | "title" | "color">[];
  /** Bảng workspace mới có lọc theo môn */
  showCourseFilter?: boolean;
  initialData?: TaskListResponse;
  initialAgendaData?: TaskListResponse;
  error?: string;
};

const matchesFilters = (
  task: MyTask,
  filters: typeof emptyBoardFilters,
  currentBoardMemberId?: string,
) =>
  filterableCardMatchesBoardFilters(
    {
      listId: task.listId,
      dueDate: task.dueDate,
      isCompleted: task.isCompleted,
      assignees: task.assignees.map((assignee) => ({ boardMemberId: assignee.boardMemberId })),
      labels: task.labelIds.map((labelId) => ({ labelId })),
      courseId: task.course?.id ?? null,
      isImportant: task.isImportant,
    },
    filters,
    currentBoardMemberId,
  );

export const BoardListView = ({
  boardId,
  boardOrgId,
  isTeamBoard,
  canEdit,
  currentBoardMemberId,
  assignableMembers,
  lists,
  labels,
  showCourseFilter,
  initialData,
  initialAgendaData,
  error,
}: BoardListViewProps) => {
  const groupMode: ListGroupMode = isTeamBoard ? "list" : "agenda";

  const { taskId, openTask, closeTask } = useTaskPanelParam();
  const { courseOptions } = useBoardCourses(boardId);
  const filters = useBoardFilters((state) => state.filtersByBoardId[boardId] ?? emptyBoardFilters);
  const clearFilters = useBoardFilters((state) => state.clearFilters);

  const [openByGroup, setOpenByGroup] = useLocalStorage<Record<string, boolean>>(TODO_GROUPS_STORAGE_KEY, {});
  const [adding, setAdding] = useState(false);

  // Một ô thêm duy nhất, vào cột "Cần làm" (hoặc cột đầu); cột "Xong" không nhận việc mới
  const addableLists = lists.filter((list) => getListStatus(list.title) !== "done");
  const addTargets = addableLists.length > 0 ? addableLists : lists;
  const targetListId = (addTargets.find((list) => getListStatus(list.title) === "todo") ?? addTargets[0])?.id;

  // Dữ liệu theo cột Kanban
  const { data: listData } = useQuery<TaskListResponse>({
    queryKey: boardTasksQueryKey(boardId),
    queryFn: () => fetcher(`/api/boards/${boardId}/tasks`),
    initialData,
    enabled: groupMode === "list",
  });

  // Dữ liệu theo thời hạn (Agenda + Việc nhóm) cho học kỳ
  const { data: agendaData } = useTodoTasks(boardId, initialAgendaData, !isTeamBoard);

  // Lọc theo cột; nhóm Xong chỉ gom việc đã tích từ mọi cột, cột "Xong" trống thì ẩn
  const columnGroups = useMemo(() => {
    const open: MyTaskGroup[] = [];
    const done: MyTask[] = [];
    for (const group of listData?.groups ?? []) {
      const tasks = group.tasks.filter((task) => matchesFilters(task, filters, currentBoardMemberId));
      const pending = tasks.filter((task) => !task.isCompleted);
      done.push(...tasks.filter((task) => task.isCompleted));
      if (pending.length === 0 && getListStatus(group.label) === "done") continue;
      open.push({ ...group, tasks: pending });
    }
    return [...open, { key: "done", label: "Xong", collapsed: true, tasks: done }];
  }, [listData?.groups, filters, currentBoardMemberId]);

  // Lọc theo thời hạn
  const allAgendaGroups = useMemo(() => agendaData?.groups ?? [], [agendaData?.groups]);
  const agendaGroups = useMemo(
    () =>
      allAgendaGroups.map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => todoTaskMatchesFilters(task, filters)),
      })),
    [allAgendaGroups, filters],
  );

  const hasAnyAgendaTask = allAgendaGroups.some((group) => group.tasks.length > 0);
  const hasVisibleAgendaTask = agendaGroups.some((group) => group.tasks.length > 0);
  const pendingAgendaGroups = agendaGroups.filter((group) => group.key !== "done" && group.tasks.length > 0);
  const pendingCount = pendingAgendaGroups.reduce((sum, group) => sum + group.tasks.length, 0);
  const overdueCount = agendaGroups.find((group) => group.key === "overdue")?.tasks.length ?? 0;
  const showInsights = !isTeamBoard && !taskId && hasAnyAgendaTask;

  const selectedCourseId = filters.selectedCourseIds.length === 1 ? filters.selectedCourseIds[0] : undefined;
  const quickAddDefaults: QuickAddDefaults = {
    myDayWhenNoDue: true,
    isImportant: filters.importantOnly,
    courseId: selectedCourseId && selectedCourseId !== PERSONAL_COURSE_FILTER ? selectedCourseId : undefined,
  };

  return (
    <div className="flex h-full items-start gap-4 overflow-hidden p-4">
      <div className="h-full min-w-0 flex-1 overflow-y-auto p-5 styled-scrollbar md:p-6">
        <div
          className={cn(
            "mx-auto",
            showInsights ? "max-w-6xl xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-8" : "max-w-3xl",
          )}
        >
        <div className="min-w-0 space-y-5">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-900">
                <ListTodo className="h-6 w-6 text-violet-600" />
                Việc cần làm
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                <span className="capitalize">{formatToday()}</span>
                {!isTeamBoard && hasAnyAgendaTask && (
                  <>
                    {" · "}còn {pendingCount} việc
                    {overdueCount > 0 && <span className="font-semibold text-rose-600"> · {overdueCount} quá hạn</span>}
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="flex items-center gap-1.5">
                {showCourseFilter && <CourseFilterBar boardId={boardId} canEdit={canEdit} tone="light" />}
                <BoardImportantToggle boardId={boardId} tone="light" />
                <BoardFilters boardId={boardId} labels={labels} tone="light" />
              </div>
            </div>
          </header>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {canEdit && (adding ? (
            <QuickAddBar
              variant="card"
              boardId={boardId}
              listId={targetListId}
              courses={isTeamBoard ? undefined : courseOptions}
              members={isTeamBoard ? assignableMembers : undefined}
              defaults={groupMode === "agenda" ? quickAddDefaults : undefined}
              placeholder="Tên việc, vd: nộp bài giải tích @mai ! #toán"
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-white/40 glass-row px-3.5 py-3 text-left text-sm text-neutral-600 transition-colors hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700"
            >
              <Plus className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Thêm việc…
            </button>
          ))}

          {groupMode === "agenda" ? (
            /* --- CHẾ ĐỘ 1: THEO THỜI HẠN / HÔM NAY / VIỆC NHÓM --- */
            <>
              {!hasAnyAgendaTask ? (
                <p className="rounded-2xl glass-row py-10 text-center text-sm text-neutral-600">
                  Không có việc nào. Thêm việc ở ô phía trên.
                </p>
              ) : !hasVisibleAgendaTask ? (
                <div className="rounded-2xl glass-row py-10 text-center text-sm text-neutral-600">
                  Không có việc khớp bộ lọc.{" "}
                  <button
                    type="button"
                    onClick={() => clearFilters(boardId)}
                    className="font-medium text-violet-600 hover:underline"
                  >
                    Xoá lọc
                  </button>
                </div>
              ) : (
                agendaGroups.map((group) => (
                  <TaskGroupSection
                    key={group.key}
                    group={group}
                    selectedTaskId={taskId}
                    onOpen={openTask}
                    isOpen={openByGroup[group.key] ?? !group.collapsed}
                    onOpenChange={(open) => setOpenByGroup((current) => ({ ...current, [group.key]: open }))}
                  />
                ))
              )}
            </>
          ) : (
            /* --- CHẾ ĐỘ 2: THEO CỘT KANBAN --- */
            <>
              {(listData?.groups ?? []).length === 0 && (
                <p className="rounded-2xl glass-row py-10 text-center text-sm text-neutral-600">Bảng chưa có cột nào.</p>
              )}
              {columnGroups.map((group) => (
                <TaskGroupSection
                  key={group.key}
                  group={group}
                  selectedTaskId={taskId}
                  onOpen={openTask}
                  showAssignees={isTeamBoard}
                  showBoardChip={false}
                  showWhenEmpty={group.key !== "done"}
                  isOpen={openByGroup[group.key] ?? !group.collapsed}
                  onOpenChange={(open) => setOpenByGroup((current) => ({ ...current, [group.key]: open }))}
                />
              ))}
            </>
          )}
        </div>
        {showInsights && (
          <div className="sticky top-0 hidden xl:block">
            <TodoInsights boardId={boardId} groups={agendaGroups} onOpen={openTask} />
          </div>
        )}
        </div>
      </div>

      {taskId && (
        <TaskDetailPanel
          taskId={taskId}
          onClose={closeTask}
          desktopClassName="top-0 h-full rounded-none border-0 border-l shadow-none"
        />
      )}
    </div>
  );
};
