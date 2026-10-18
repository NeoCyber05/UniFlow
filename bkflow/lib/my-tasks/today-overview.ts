import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";

import type { MyTask } from "./types";
import { getEndOfVNDay, getVNDay, isSameVNDay } from "./vn-day";

export const buildTodayOverview = (tasks: readonly MyTask[], now: Date) => {
  const endOfToday = getEndOfVNDay(getVNDay(now)).getTime();
  const deadline = (task: MyTask) => getTaskDeadlineAt(task)?.getTime() ?? Infinity;
  const pending = tasks.filter(task => !task.isCompleted).sort((a, b) =>
    deadline(a) - deadline(b) || Number(b.isImportant) - Number(a.isImportant) || a.title.localeCompare(b.title, "vi"));
  const attention = pending.filter(task => deadline(task) <= endOfToday || task.isImportant ||
    Boolean(task.myDayAt && isSameVNDay(new Date(task.myDayAt), now)));

  return {
    pending,
    attention,
    upcoming: pending.filter(task => deadline(task) !== Infinity && deadline(task) >= now.getTime()),
    focus: pending[0] ?? null,
    overdue: pending.filter(task => deadline(task) < now.getTime()).length,
    dueToday: pending.filter(task => deadline(task) >= now.getTime() && deadline(task) <= endOfToday).length,
  };
};
