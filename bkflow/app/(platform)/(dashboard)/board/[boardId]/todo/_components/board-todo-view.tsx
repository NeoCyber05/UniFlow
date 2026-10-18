import { BoardMember } from "@/types";
"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Label, List } from "@prisma/client";
import { AlertCircle, ListTodo, Sparkles } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { SmartCaptureDialog } from "@/app/(platform)/(dashboard)/board/[boardId]/_components/smart-capture-dialog";
import { QuickAddBar, type QuickAddDefaults } from "@/components/my-tasks/quick-add-bar";
import { TaskDetailPanel } from "@/components/my-tasks/task-detail-panel";
import { TaskGroupSection } from "@/components/my-tasks/task-group-section";
import { useBoardCourses } from "@/hooks/use-board-courses";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { useTodoTasks } from "@/hooks/use-my-tasks";
import { useTaskPanelParam } from "@/hooks/use-task-panel-param";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { todoTaskMatchesFilters } from "@/lib/my-tasks/todo-filters";
import { MY_TASKS_ROOT_KEY, type TaskListResponse } from "@/lib/my-tasks/types";

const TODO_GROUPS_STORAGE_KEY = "uniflow:todo-groups";

const formatToday = () =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

type BoardTodoViewProps = {
  boardId: string;
  boardOrgId: string;
  canEdit: boolean;
  lists: Pick<List, "id" | "title">[];
  members: Pick<BoardMember, "id" | "userName" | "userEmail" | "role">[];
  labels: Pick<Label, "id" | "title" | "color">[];
  initialData: TaskListResponse;
  error?: string;
};

export const BoardTodoView = ({
  boardId,
  boardOrgId,
  canEdit,
  lists,
  members,
  labels,
  initialData,
  error,
}: BoardTodoViewProps) => {
  const queryClient = useQueryClient();
  const { taskId, openTask, closeTask } = useTaskPanelParam();
  const { courses } = useBoardCourses(boardId);
  const filters = useBoardFilters((state) => state.filtersByBoardId[boardId] ?? emptyBoardFilters);
  const clearFilters = useBoardFilters((state) => state.clearFilters);
  const [openByGroup, setOpenByGroup] = useLocalStorage<Record<string, boolean>>(TODO_GROUPS_STORAGE_KEY, {});
  const [captureOpen, setCaptureOpen] = useState(false);
  const { data } = useTodoTasks(boardId, initialData);

  const allGroups = useMemo(() => data?.groups ?? [], [data?.groups]);
  const groups = useMemo(
    () =>
      allGroups.map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => todoTaskMatchesFilters(task, filters)),
      })),
    [allGroups, filters],
  );
  const hasAnyTask = allGroups.some((group) => group.tasks.length > 0);
  const hasVisibleTask = groups.some((group) => group.tasks.length > 0);

  const selectedCourseId = filters.selectedCourseIds.length === 1 ? filters.selectedCourseIds[0] : undefined;
  const quickAddDefaults: QuickAddDefaults = {
    myDayWhenNoDue: true,
    isImportant: filters.importantOnly,
    courseId: selectedCourseId && selectedCourseId !== PERSONAL_COURSE_FILTER ? selectedCourseId : undefined,
  };

  return (
    <div className="flex h-full items-start gap-4 overflow-hidden p-4">
      <div className="h-full min-w-0 flex-1 overflow-y-auto rounded-2xl bg-white/95 p-5 shadow-sm backdrop-blur styled-scrollbar">
        <div className="mx-auto max-w-3xl space-y-5">
          <header>
            <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
              <ListTodo className="h-5 w-5 text-violet-600" />
              Việc cần làm
            </h1>
            <p className="mt-0.5 text-sm capitalize text-neutral-500">{formatToday()}</p>
          </header>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {canEdit && (
            <QuickAddBar
              boardId={boardId}
              courses={courses}
              defaults={quickAddDefaults}
              trailing={
                <button
                  type="button"
                  onClick={() => setCaptureOpen(true)}
                  title="Smart Capture: dán ghi chú dài, AI tách thành nhiều việc"
                  className="rounded-md p-1 text-violet-500 hover:bg-violet-50"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              }
            />
          )}

          {!hasAnyTask ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-500">
              Không có việc nào. Thêm việc ở ô phía trên.
            </p>
          ) : !hasVisibleTask ? (
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
            groups.map((group) => (
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
        </div>
      </div>

      {taskId && (
        <TaskDetailPanel
          taskId={taskId}
          onClose={closeTask}
          desktopClassName="top-0 h-full"
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
