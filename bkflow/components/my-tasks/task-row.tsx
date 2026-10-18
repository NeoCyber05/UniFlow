"use client";

import { CalendarDays, Check, ListChecks, Star, Sun, Users } from "lucide-react";

import { useMyTaskMutations } from "@/hooks/use-my-task-mutations";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import type { MyTask } from "@/lib/my-tasks/types";
import { formatVNShortDate, isSameVNDay } from "@/lib/my-tasks/vn-day";
import { cn } from "@/lib/utils";

import { AssigneeStack } from "./assignee-stack";

type TaskRowProps = {
  task: MyTask;
  isSelected?: boolean;
  onOpen: (taskId: string) => void;
  /** Hiện avatar người làm (ngữ cảnh nhóm / List view bảng nhóm) */
  showAssignees?: boolean;
  /** Ẩn chip tên bảng nhóm khi đang ở trong chính bảng đó */
  showBoardChip?: boolean;
};

export const TaskRow = ({
  task,
  isSelected = false,
  onOpen,
  showAssignees = false,
  showBoardChip = true,
}: TaskRowProps) => {
  const { setCompleted, setImportant, setMyDay } = useMyTaskMutations();
  const now = new Date();
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = !task.isCompleted && due !== null && due < now;
  const isPinned = task.myDayAt !== null && isSameVNDay(new Date(task.myDayAt), now);
  const courseColor = task.course ? getCourseColor(task.course.color) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(task.id);
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition hover:border-violet-200 hover:shadow-sm",
        isSelected ? "border-violet-300 ring-2 ring-violet-100" : "border-neutral-200",
      )}
    >
      <button
        type="button"
        aria-label={task.isCompleted ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
        onClick={(event) => {
          event.stopPropagation();
          void setCompleted(task.id, !task.isCompleted);
        }}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
          task.isCompleted
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-neutral-300 hover:border-violet-500",
        )}
      >
        {task.isCompleted && <Check className="h-3 w-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium text-neutral-800", task.isCompleted && "text-neutral-400 line-through")}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
          {task.course && courseColor && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1", courseColor.chip)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", courseColor.dot)} />
              {getCourseShortLabel(task.course)}
            </span>
          )}
          {showBoardChip && task.boardType === "TEAM_PROJECT" && (
            <span className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full bg-sky-50 px-1.5 py-0.5 text-sky-700 ring-1 ring-sky-200">
              <Users className="h-3 w-3 shrink-0" />
              {task.boardTitle}
            </span>
          )}
          {due && (
            <span className={cn("inline-flex items-center gap-1", isOverdue && "font-semibold text-rose-600")}>
              <CalendarDays className="h-3 w-3" />
              {formatVNShortDate(due)}
            </span>
          )}
          {task.checklist.total > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {task.checklist.completed}/{task.checklist.total}
            </span>
          )}
          {isPinned && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Sun className="h-3 w-3" />
              Hôm nay
            </span>
          )}
        </div>
      </div>

      {showAssignees && <AssigneeStack assignees={task.assignees} />}

      <button
        type="button"
        aria-label={isPinned ? "Bỏ khỏi Hôm nay" : "Thêm vào Hôm nay"}
        title={isPinned ? "Bỏ khỏi Hôm nay" : "Thêm vào Hôm nay"}
        onClick={(event) => {
          event.stopPropagation();
          void setMyDay(task.id, !isPinned);
        }}
        className={cn(
          "rounded-md p-1 text-neutral-400 transition hover:bg-amber-50 hover:text-amber-500",
          isPinned ? "text-amber-500" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
        )}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={task.isImportant ? "Bỏ đánh dấu quan trọng" : "Đánh dấu quan trọng"}
        onClick={(event) => {
          event.stopPropagation();
          void setImportant(task.id, !task.isImportant);
        }}
        className="rounded-md p-1 text-neutral-400 transition hover:bg-amber-50 hover:text-amber-500"
      >
        <Star className={cn("h-4 w-4", task.isImportant && "fill-amber-400 text-amber-400")} />
      </button>
    </div>
  );
};
