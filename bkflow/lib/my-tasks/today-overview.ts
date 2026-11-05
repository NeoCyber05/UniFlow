import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";

import type { MyTask } from "./types";
import { getEndOfVNDay, getVNDay, getVNDayKey, getVNWeekday, isSameVNDay, type VNDay } from "./vn-day";

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

export type UpcomingDay<T> = { key: string; day: VNDay; offset: number; weekday: number; tasks: T[] };

/** "Sắp đến hạn" chia theo ngày giờ VN; offset 0 là hôm nay, 1 là ngày mai. Lấy tối đa `limit` việc, phần dư trả về `rest`. */
export const groupUpcomingByDay = <T extends MyTask>(upcoming: readonly T[], now: Date, limit = 5) => {
  const today = getVNDay(now);
  const todayStart = Date.UTC(today.year, today.month, today.day);
  const days: UpcomingDay<T>[] = [];
  for (const task of upcoming.slice(0, limit)) {
    const due = getTaskDeadlineAt(task);
    if (!due) continue;
    const day = getVNDay(due);
    const key = getVNDayKey(day);
    let group = days.find((item) => item.key === key);
    if (!group) {
      group = { key, day, offset: Math.round((Date.UTC(day.year, day.month, day.day) - todayStart) / 86_400_000), weekday: getVNWeekday(day), tasks: [] };
      days.push(group);
    }
    group.tasks.push(task);
  }
  return { days, rest: Math.max(0, upcoming.length - limit) };
};
