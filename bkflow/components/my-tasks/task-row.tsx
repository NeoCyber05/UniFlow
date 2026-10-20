"use client";

import { memo } from "react";
import { tr } from "@/lib/i18n";
import { AnimatePresence, motion } from "motion/react";
import {
  blur,
  scale,
  spring,
  transition,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import { CalendarDays, Check, Clock, ListChecks, Star, Sun, Users } from "lucide-react";

import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { useMyTaskMutations } from "@/hooks/use-my-task-mutations";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import type { MyTask } from "@/lib/my-tasks/types";
import { formatVNShortDate, isSameVNDay } from "@/lib/my-tasks/vn-day";
import { cn } from "@/lib/utils";

import { TaskLabels } from "@/components/tasks/task-labels";

import { AssigneeStack } from "./assignee-stack";

const formatVNTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

type TaskRowProps = {
  task: MyTask;
  isSelected?: boolean;
  onOpen: (taskId: string) => void;
  /** Hiện avatar người làm (ngữ cảnh nhóm / List view bảng nhóm) */
  showAssignees?: boolean;
  /** Ẩn chip tên bảng nhóm khi đang ở trong chính bảng đó */
  showBoardChip?: boolean;
};

export const TaskRow = memo(function TaskRow({
  task,
  isSelected = false,
  onOpen,
  showAssignees = false,
  showBoardChip = true,
}: TaskRowProps) {
  const { setCompleted, setImportant, setMyDay } = useMyTaskMutations();
  const now = new Date();
  const due = getTaskDeadlineAt(task);
  const isOverdue = !task.isCompleted && due !== null && due < now;
  const isDueToday = !task.isCompleted && !isOverdue && due !== null && isSameVNDay(due, now);
  const press = useTempoTransition(spring.press);
  const checkPop = useTempoTransition(spring.checkPop);
  const popOut = useTempoTransition(transition.popOut);
  const isPinned = task.myDayAt !== null && isSameVNDay(new Date(task.myDayAt), now);
  const courseColor = task.course ? getCourseColor(task.course.color) : null;
  const isEvent = task.kind === "EVENT";

  return (
    // Cả hàng bấm chuột để mở, nhưng bàn phím chỉ qua nút tiêu đề; control con độc lập (không lồng button).
    <div
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("button,a,input,[role=dialog]")) onOpen(task.id);
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-xl border glass-row px-3 py-2.5 transition hover:border-violet-200 hover:shadow-sm",
        isSelected ? "border-violet-300 ring-2 ring-violet-100" : "border-neutral-200",
      )}
    >
      {isEvent ? (
        // Sự kiện (buổi học) chỉ để xem: không có checkbox hoàn thành
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sky-500" title={tr("task.event")}>
          <Clock className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : (
      <motion.button
        type="button"
        whileTap={{ scale: scale.press }}
        transition={press}
        aria-label={task.isCompleted ? tr("task.markIncomplete") : tr("task.markComplete")}
        onClick={(event) => {
          event.stopPropagation();
          void setCompleted(task.id, !task.isCompleted);
        }}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
          task.isCompleted
            ? "border-emerald-500 bg-emerald-500 text-white"
            : isOverdue
              ? "border-rose-300 hover:border-rose-500 hover:bg-rose-50"
              : "border-neutral-300 hover:border-violet-500 hover:bg-violet-50",
        )}
      >
        <AnimatePresence initial={false}>
          {task.isCompleted && (
            <motion.span
              initial={{ opacity: 0, scale: scale.icon, filter: blur.icon }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: checkPop }}
              exit={{ opacity: 0, scale: scale.icon, transition: popOut }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      )}

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className={cn(
            "block max-w-full truncate rounded text-left text-sm font-medium text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400",
            task.isCompleted && "text-neutral-400 line-through",
          )}
        >
          {task.title}
        </button>
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
          {isEvent && task.scheduledStartAt && task.scheduledEndAt && (
            <span className="inline-flex items-center gap-1 text-sky-700">
              <Clock className="h-3 w-3" />
              {formatVNShortDate(new Date(task.scheduledStartAt))} {formatVNTime(task.scheduledStartAt)}–{formatVNTime(task.scheduledEndAt)}
            </span>
          )}
          {due && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                (isOverdue || isDueToday) && "rounded-full px-1.5 py-0.5 font-semibold ring-1",
                isOverdue && "bg-rose-50 text-rose-600 ring-rose-200",
                isDueToday && "bg-amber-50 text-amber-700 ring-amber-200",
              )}
            >
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
          <TaskLabels labels={task.labels} mode="compact" />
          {isPinned && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Sun className="h-3 w-3" />
              {tr("common.today")}
            </span>
          )}
        </div>
      </div>

      {showAssignees && <AssigneeStack assignees={task.assignees} />}

      <button
        type="button"
        aria-label={isPinned ? tr("task.unpin") : tr("task.pin")}
        title={isPinned ? tr("task.unpin") : tr("task.pin")}
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
        aria-label={task.isImportant ? tr("task.unmarkImportant") : tr("task.markImportant")}
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
});

TaskRow.displayName = "TaskRow";
