"use client";

import { BoardMember } from "@/types";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Label, List } from "@prisma/client";
import { AlertCircle, CalendarClock, Layers, ListTodo, Plus, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { ReducedMotionConfig, spring, useTempoTransition } from "@animate-ui/react/utils/motion";
import { useSearchParams } from "@/web/shims/next-navigation";
import { useLocalStorage } from "usehooks-ts";

import { SmartCaptureDialog } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/smart-capture-dialog";
import { QuickAddBar, type QuickAddDefaults } from "@/components/my-tasks/quick-add-bar";
import { TaskDetailPanel } from "@/components/my-tasks/task-detail-panel";
import { TaskLayoutSwitcher } from "@/components/my-tasks/task-layout-switcher";
import { getGroupTone, TaskGroupSection } from "@/components/my-tasks/task-group-section";
import { TodoInsights } from "@/components/my-tasks/todo-insights";
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
    enabled: groupMode === "list",
  });

  // Dữ liệu theo thời hạn (Agenda + Việc nhóm) cho học kỳ
  const { data: agendaData } = useTodoTasks(boardId, initialAgendaData, groupMode === "agenda");

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
  const pendingAgendaGroups = agendaGroups.filter((group) => group.key !== "done" && group.tasks.length > 0);
  const pendingCount = pendingAgendaGroups.reduce((sum, group) => sum + group.tasks.length, 0);
  const overdueCount = agendaGroups.find((group) => group.key === "overdue")?.tasks.length ?? 0;
  const showInsights = groupMode === "agenda" && !taskId && hasAnyAgendaTask;
  const slide = useTempoTransition(spring.selection);

  // Chip nhảy tới nhóm: mở nhóm nếu đang gập rồi cuộn tới
  const jumpToGroup = (key: string) => {
    setOpenByGroup((current) => ({ ...current, [key]: true }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document.getElementById(`task-group-${key}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
    );
  };

  const selectedCourseId = filters.selectedCourseIds.length === 1 ? filters.selectedCourseIds[0] : undefined;
  const quickAddDefaults: QuickAddDefaults = {
    myDayWhenNoDue: true,
    isImportant: filters.importantOnly,
    courseId: selectedCourseId && selectedCourseId !== PERSONAL_COURSE_FILTER ? selectedCourseId : undefined,
  };

  return (
    <div className="flex h-full items-start gap-4 overflow-hidden p-4">
      <div className="h-full min-w-0 flex-1 overflow-y-auto rounded-2xl bg-white/95 p-5 shadow-sm backdrop-blur styled-scrollbar md:p-6">
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
                {groupMode === "agenda" && hasAnyAgendaTask && (
                  <>
                    {" · "}còn {pendingCount} việc
                    {overdueCount > 0 && <span className="font-semibold text-rose-600"> · {overdueCount} quá hạn</span>}
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
            <TaskLayoutSwitcher boardId={boardId} layout="rows" />
            {!isTeamBoard && <span aria-hidden="true" className="h-5 w-px bg-neutral-200" />}
            {/* Chế độ nhóm: nền trắng trượt giữa hai lựa chọn */}
            {!isTeamBoard && (
              <ReducedMotionConfig>
                <div
                  role="radiogroup"
                  aria-label="Cách nhóm việc"
                  className="inline-flex shrink-0 items-center rounded-xl bg-neutral-100 p-1 text-xs font-medium"
                >
                  {([
                    ["agenda", "Theo hạn", CalendarClock],
                    ["list", "Theo cột", Layers],
                  ] as const).map(([mode, label, Icon]) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={groupMode === mode}
                      onClick={() => setStoredGroupMode(mode)}
                      className={cn(
                        "relative flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors duration-200",
                        groupMode === mode ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900",
                      )}
                    >
                      {groupMode === mode && (
                        <motion.span
                          layoutId={`list-group-mode-${boardId}`}
                          transition={slide}
                          className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/70"
                        />
                      )}
                      <Icon className={cn("relative z-10 h-3.5 w-3.5", groupMode === mode && "text-violet-600")} />
                      <span className="relative z-10">{label}</span>
                    </button>
                  ))}
                </div>
              </ReducedMotionConfig>
            )}
            </div>
          </header>

          {/* Chip nhảy nhanh tới nhóm theo độ gấp */}
          {groupMode === "agenda" && pendingAgendaGroups.length > 1 && (
            <nav aria-label="Nhảy tới nhóm" className="flex flex-wrap gap-2">
              {pendingAgendaGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => jumpToGroup(group.key)}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 transition-[filter] duration-200 hover:brightness-95",
                    getGroupTone(group.key).chip,
                  )}
                >
                  {group.label}
                  <span className="tabular-nums opacity-80">{group.tasks.length}</span>
                </button>
              ))}
            </nav>
          )}

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
        {showInsights && (
          <div className="sticky top-0 hidden xl:block">
            <TodoInsights boardId={boardId} groups={agendaGroups} />
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
