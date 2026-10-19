import { BoardMember } from "@/types";
"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Label, List } from "@prisma/client";
import { AlertCircle, CalendarClock, Columns3, ListFilter, Plus, Sparkles } from "lucide-react";
import { useSearchParams } from "@/web/shims/next-navigation";
import { useLocalStorage } from "usehooks-ts";

import { SmartCaptureDialog } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/smart-capture-dialog";
import { QuickAddBar, type QuickAddDefaults } from "@/components/my-tasks/quick-add-bar";
import { TaskDetailPanel } from "@/components/my-tasks/task-detail-panel";
import { TaskGroupSection } from "@/components/my-tasks/task-group-section";
import { useBoardCourses } from "@/hooks/use-board-courses";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { useTodoTasks } from "@/hooks/use-my-tasks";
import { useTaskPanelParam } from "@/hooks/use-task-panel-param";
import { filterableCardMatchesBoardFilters, PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { fetcher } from "@/lib/fetcher";
import { todoTaskMatchesFilters } from "@/lib/my-tasks/todo-filters";
import {
  boardTasksQueryKey,
  MY_TASKS_ROOT_KEY,
  type MyTask,
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
  members,
  labels,
  initialData,
  initialAgendaData,
  error,
}: BoardListViewProps) => {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const groupParam = searchParams.get("group");
  const [storedGroupMode, setStoredGroupMode] = useLocalStorage<ListGroupMode>(
    `uniflow:list-group-mode:${boardId}`,
    isTeamBoard ? "list" : "agenda",
  );

  const groupMode: ListGroupMode = isTeamBoard
    ? "list"
    : groupParam === "list" || groupParam === "agenda"
      ? groupParam
      : storedGroupMode;

  const { taskId, openTask, closeTask } = useTaskPanelParam();
  const { courseOptions } = useBoardCourses(boardId);
  const filters = useBoardFilters((state) => state.filtersByBoardId[boardId] ?? emptyBoardFilters);
  const clearFilters = useBoardFilters((state) => state.clearFilters);

  const [openByGroup, setOpenByGroup] = useLocalStorage<Record<string, boolean>>(TODO_GROUPS_STORAGE_KEY, {});
  const [captureOpen, setCaptureOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingListId, setAddingListId] = useState<string | null>(null);

  // Dữ liệu theo cột Kanban
  const { data: listData } = useQuery<TaskListResponse>({
    queryKey: boardTasksQueryKey(boardId),
    queryFn: () => fetcher(`/api/boards/${boardId}/tasks`),
    initialData,
  });

  // Dữ liệu theo thời hạn (Agenda + Việc nhóm) cho học kỳ
  const { data: agendaData } = useTodoTasks(boardId, initialAgendaData);

  // Lọc theo cột
  const columnGroups = useMemo(
    () =>
      (listData?.groups ?? []).map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => matchesFilters(task, filters, currentBoardMemberId)),
      })),
    [listData?.groups, filters, currentBoardMemberId],
  );

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

  const selectedCourseId = filters.selectedCourseIds.length === 1 ? filters.selectedCourseIds[0] : undefined;
  const quickAddDefaults: QuickAddDefaults = {
    myDayWhenNoDue: true,
    isImportant: filters.importantOnly,
    courseId: selectedCourseId && selectedCourseId !== PERSONAL_COURSE_FILTER ? selectedCourseId : undefined,
  };

  return (
    <div className="flex h-full items-stretch overflow-hidden bg-white/95 backdrop-blur">
      <div className="h-full min-w-0 flex-1 overflow-y-auto styled-scrollbar">
        <div className="mx-auto max-w-3xl space-y-5 px-5 pb-24 sm:px-8">
          <header className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 border-b border-neutral-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
                <ListFilter className="h-5 w-5 text-violet-600" />
                Danh sách
              </h1>
              {groupMode === "agenda" && (
                <p className="mt-0.5 text-sm capitalize text-neutral-500">{formatToday()}</p>
              )}
            </div>

            {/* Chế độ nhóm: cho phép người dùng chọn xem theo thời hạn hoặc theo cột */}
            {!isTeamBoard && (
              <div className="inline-flex items-center rounded-xl bg-neutral-100 p-1 text-xs font-medium text-neutral-600 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setStoredGroupMode("agenda")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer",
                    groupMode === "agenda"
                      ? "bg-white text-neutral-900 shadow-sm font-semibold"
                      : "hover:text-neutral-900 hover:bg-neutral-200/60"
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5 text-violet-600" />
                  Thời hạn & Việc nhóm
                </button>
                <button
                  type="button"
                  onClick={() => setStoredGroupMode("list")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer",
                    groupMode === "list"
                      ? "bg-white text-neutral-900 shadow-sm font-semibold"
                      : "hover:text-neutral-900 hover:bg-neutral-200/60"
                  )}
                >
                  <Columns3 className="h-3.5 w-3.5 text-neutral-500" />
                  Theo cột
                </button>
              </div>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 self-start rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 sm:self-auto"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Thêm việc
              </button>
            )}
          </header>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {groupMode === "agenda" ? (
            /* --- CHẾ ĐỘ 1: THEO THỜI HẠN / HÔM NAY / VIỆC NHÓM --- */
            <>
              {canEdit && (adding ? (
                <QuickAddBar
                  variant="card"
                  boardId={boardId}
                  courses={courseOptions}
                  defaults={quickAddDefaults}
                  placeholder="Tên việc, vd: nộp bài giải tích @mai ! #toán"
                  onCancel={() => setAdding(false)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setCaptureOpen(true)}
                      title="Smart Capture: dán ghi chú dài, AI tách thành nhiều việc"
                      className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-violet-600 hover:bg-violet-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Smart Capture
                    </button>
                  }
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3.5 py-3 text-left text-sm text-neutral-500 transition-colors hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700"
                >
                  <Plus className="h-4 w-4 text-violet-600" aria-hidden="true" />
                  Thêm việc…
                </button>
              ))}

              {!hasAnyAgendaTask ? (
                <p className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-500">
                  Không có việc nào. Thêm việc ở ô phía trên.
                </p>
              ) : !hasVisibleAgendaTask ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-500">
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
              {columnGroups.length === 0 && (
                <p className="py-10 text-center text-sm text-neutral-500">Bảng chưa có cột nào.</p>
              )}
              {columnGroups.map((group) => (
                <TaskGroupSection
                  key={group.key}
                  group={group}
                  selectedTaskId={taskId}
                  onOpen={openTask}
                  showAssignees={isTeamBoard}
                  showBoardChip={false}
                  showWhenEmpty
                  header={
                    canEdit ? (
                      addingListId === group.key ? (
                        <QuickAddBar
                          variant="card"
                          boardId={boardId}
                          listId={group.key}
                          courses={isTeamBoard ? undefined : courseOptions}
                          members={isTeamBoard ? assignableMembers : undefined}
                          placeholder={`Tên việc trong "${group.label}"`}
                          onCancel={() => setAddingListId(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingListId(group.key)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Thêm việc vào {group.label}
                        </button>
                      )
                    ) : null
                  }
                />
              ))}
            </>
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

      {canEdit && (
        <SmartCaptureDialog
          boardId={boardId}
          open={captureOpen}
          onOpenChange={(open) => {
            setCaptureOpen(open);
            if (!open) void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
          }}
          lists={lists}
          members={members}
          labels={labels}
        />
      )}
    </div>
  );
};
