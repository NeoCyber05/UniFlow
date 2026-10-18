import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";

import {
  addVNDays,
  getEndOfVNDay,
  getVNDay,
  getVNWeekday,
  isSameVNDay,
} from "./vn-day";

export type BucketTask = {
  id: string;
  dueDate: Date | null;
  /** Hạn chỉ-ngày YYYY-MM-DD (loại trừ dueDate) */
  deadlineOn?: string | null;
  isCompleted: boolean;
  updatedAt: Date;
  /** CardUserState.myDayAt của user hiện tại */
  myDayAt: Date | null;
};

export type TaskGroup<T> = {
  key: string;
  label: string;
  tasks: T[];
  collapsed?: boolean;
};

export type AgendaGroupKey = "overdue" | "today" | "tomorrow" | "week" | "later" | "nodue" | "done";

export const AGENDA_GROUPS: { key: AgendaGroupKey; label: string; collapsed: boolean }[] = [
  { key: "overdue", label: "Quá hạn", collapsed: false },
  { key: "today", label: "Hôm nay", collapsed: false },
  { key: "tomorrow", label: "Ngày mai", collapsed: false },
  { key: "week", label: "Tuần này", collapsed: true },
  { key: "later", label: "Sau đó", collapsed: true },
  { key: "nodue", label: "Không hạn", collapsed: true },
  { key: "done", label: "Đã xong hôm nay", collapsed: true },
];

export const byDueAsc = <T extends { dueDate: Date | null; deadlineOn?: string | null }>(tasks: T[]): T[] =>
  tasks
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aDue = getTaskDeadlineAt(a.item)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDue = getTaskDeadlineAt(b.item)?.getTime() ?? Number.POSITIVE_INFINITY;

      if (aDue !== bDue) return aDue < bDue ? -1 : 1;

      return a.index - b.index;
    })
    .map(({ item }) => item);

export const isPinnedToday = (task: BucketTask, now: Date) =>
  task.myDayAt !== null && isSameVNDay(task.myDayAt, now);

/** Mỗi việc thuộc đúng một nhóm; null = không hiển thị (đã xong trước hôm nay). */
export const getAgendaGroupKey = (task: BucketTask, now: Date): AgendaGroupKey | null => {
  if (task.isCompleted) {
    return isSameVNDay(task.updatedAt, now) ? "done" : null;
  }

  const today = getVNDay(now);
  const due = getTaskDeadlineAt(task);

  if (due && due < now) return "overdue";
  if ((due && due <= getEndOfVNDay(today)) || isPinnedToday(task, now)) return "today";
  if (!due) return "nodue";
  if (due <= getEndOfVNDay(addVNDays(today, 1))) return "tomorrow";

  const daysToSunday = (7 - getVNWeekday(today)) % 7;

  if (due <= getEndOfVNDay(addVNDays(today, daysToSunday))) return "week";

  return "later";
};

export const groupAgendaTasks = <T extends BucketTask>(tasks: T[], now: Date): TaskGroup<T>[] => {
  const buckets = new Map<AgendaGroupKey, T[]>(AGENDA_GROUPS.map((group) => [group.key, []]));

  for (const task of byDueAsc(tasks)) {
    const key = getAgendaGroupKey(task, now);

    if (key) buckets.get(key)?.push(task);
  }

  return AGENDA_GROUPS.map(({ key, label, collapsed }) => ({
    key,
    label,
    tasks: buckets.get(key) ?? [],
    ...(collapsed ? { collapsed: true } : {}),
  }));
};
