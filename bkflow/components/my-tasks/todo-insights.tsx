"use client";

import { useMemo, useState } from "react";
import { getIntlLocale, tr, useLocale } from "@/lib/i18n";
import { motion } from "motion/react";
import { ReducedMotionConfig, spring, useTempoTransition } from "@animate-ui/react/utils/motion";
import { ArrowRight } from "lucide-react";
import Link from "@/web/shims/next-link";

import { useBoardFilters } from "@/hooks/use-board-filters";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import type { MyTask, MyTaskGroup } from "@/lib/my-tasks/types";
import { addVNDays, getVNDay, getVNDayKey, getVNWeekday } from "@/lib/my-tasks/vn-day";
import { cn } from "@/lib/utils";

import { TaskRow } from "./task-row";

const WEEKDAY_LABEL_KEYS = [
  "agenda.weekday.0",
  "agenda.weekday.1",
  "agenda.weekday.2",
  "agenda.weekday.3",
  "agenda.weekday.4",
  "agenda.weekday.5",
  "agenda.weekday.6",
] as const;

type TodoInsightsProps = {
  boardId: string;
  groups: MyTaskGroup[];
  onOpen: (taskId: string) => void;
};

export const TodoInsights = ({ boardId, groups, onOpen }: TodoInsightsProps) => {
  // Ngày (YYYY-MM-DD, giờ VN) đang xem; việc của ngày hiện ngay dưới cụm 7 ngày
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const locale = useLocale((state) => state.locale);
  const setSelectedCourses = useBoardFilters((state) => state.setSelectedCourses);
  const progressSpring = useTempoTransition(spring.progress);
  const barSpring = useTempoTransition(spring.number);

  const stats = useMemo(() => {
    void locale;
    const byKey = Object.fromEntries(groups.map((group) => [group.key, group.tasks])) as Record<string, MyTask[]>;
    const doneToday = byKey.done?.length ?? 0;
    const dueToday = (byKey.overdue?.length ?? 0) + (byKey.today?.length ?? 0);
    const pending = groups.filter((group) => group.key !== "done").flatMap((group) => group.tasks);
    const next = byKey.today?.[0] ?? byKey.overdue?.[0] ?? byKey.tomorrow?.[0] ?? null;

    const today = getVNDay(new Date());
    const countByDay = new Map<string, number>();
    for (const task of pending) {
      const due = getTaskDeadlineAt(task);
      if (!due) continue;
      const key = getVNDayKey(getVNDay(due));
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    }
    const days = Array.from({ length: 7 }, (_, offset) => {
      const day = addVNDays(today, offset);
      return {
        key: getVNDayKey(day),
        weekday: tr(WEEKDAY_LABEL_KEYS[getVNWeekday(day)]),
        date: day.day,
        count: countByDay.get(getVNDayKey(day)) ?? 0,
      };
    });

    const courseMap = new Map<string, { id: string; label: string; dot: string; count: number }>();
    for (const task of pending) {
      const id = task.course?.id ?? PERSONAL_COURSE_FILTER;
      const entry = courseMap.get(id) ?? {
        id,
        label: task.course ? getCourseShortLabel(task.course) : tr("common.personal"),
        dot: task.course ? getCourseColor(task.course.color).dot : "bg-neutral-300",
        count: 0,
      };
      entry.count += 1;
      courseMap.set(id, entry);
    }
    const courses = [...courseMap.values()].sort((a, b) => b.count - a.count);

    return { doneToday, total: doneToday + dueToday, next, days, courses };
  }, [groups, locale]);

  const dayTasks = useMemo(() => {
    if (!selectedDayKey) return [];
    return groups
      .flatMap((group) => group.tasks)
      .filter((task) => {
        const due = getTaskDeadlineAt(task);
        return !!due && getVNDayKey(getVNDay(due)) === selectedDayKey;
      })
      .sort((a, b) => (getTaskDeadlineAt(a)?.getTime() ?? 0) - (getTaskDeadlineAt(b)?.getTime() ?? 0));
  }, [groups, selectedDayKey]);

  const ratio = stats.total === 0 ? 0 : stats.doneToday / stats.total;
  const maxCourseCount = Math.max(1, ...stats.courses.map((course) => course.count));
  const nextDue = stats.next ? getTaskDeadlineAt(stats.next) : null;

  return (
    <ReducedMotionConfig>
      <aside className="flex flex-col gap-3">
        <section className="border-b border-border pb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{tr("common.today")}</h3>
            <span className="text-xs tabular-nums text-muted-foreground">{tr("insights.doneCount", { done: stats.doneToday, total: stats.total })}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full rounded-full bg-slate-500" initial={{ width: 0 }} animate={{ width: `${ratio * 100}%` }} transition={progressSpring} />
          </div>
          {stats.next && <button type="button" onClick={() => onOpen(stats.next!.id)} className="mt-4 w-full rounded-lg bg-slate-50 p-3 text-left text-sm hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800">
            <span className="mb-1 block text-xs text-muted-foreground">{tr("insights.next")}{nextDue && ` · ${nextDue.toLocaleTimeString(getIntlLocale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}`}</span>
            <span className="font-medium">{stats.next.title}</span>
          </button>}
        </section>

        {/* 7 ngày tới */}
        <section className="border-b border-border py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">{tr("insights.next7")}</h3>
            <Link
              href={`/board/${boardId}/calendar`}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              {tr("insights.openCalendar")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {stats.days.map((day, index) => {
              const selected = selectedDayKey === day.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedDayKey(selected ? null : day.key)}
                  title={day.count > 0 ? tr("insights.dueCount", { count: day.count }) : tr("insights.noTasks")}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl py-2 transition-colors duration-200 cursor-pointer",
                    index === 0 ? "bg-neutral-900 text-white" : "bg-neutral-50 text-neutral-800 hover:bg-neutral-100",
                    selected && "ring-2 ring-slate-500 ring-offset-1",
                  )}
                >
                  <span className={cn("text-[10px] font-semibold", index === 0 ? "text-neutral-100" : "text-neutral-500")}>
                    {day.weekday}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{day.date}</span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {Array.from({ length: Math.min(day.count, 3) }, (_, dot) => (
                      <span key={dot} className={cn("h-1 w-1 rounded-full", index === 0 ? "bg-white" : "bg-slate-500")} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Việc của ngày đang chọn */}
        {selectedDayKey && (
          <section className="border-b border-border py-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                {tr("agenda.tasksOnDay", { day: selectedDayKey.slice(8), month: selectedDayKey.slice(5, 7) })}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="text-xs font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {tr("common.close")}
              </button>
            </div>
            {dayTasks.length === 0 ? (
              <p className="text-xs text-neutral-500">{tr("agenda.noTasksOnDay")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {dayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onOpen={onOpen} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Theo môn học: bấm để lọc nhanh */}
        {stats.courses.length > 0 && (
          <section className="border-b border-border py-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">{tr("insights.byCourse")}</h3>
            <div className="flex flex-col">
              {stats.courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setSelectedCourses(boardId, [course.id])}
                  title={tr("insights.onlyCourse", { course: course.label })}
                  className="-mx-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 hover:bg-neutral-50"
                >
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", course.dot)} />
                    <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">{course.label}</span>
                    <span className="text-xs tabular-nums text-neutral-500">{course.count} {tr("insights.taskUnit")}</span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-neutral-100">
                    <motion.span
                      className={cn("block h-full origin-left rounded-full", course.dot)}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: course.count / maxCourseCount }}
                      transition={barSpring}
                    />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </aside>
    </ReducedMotionConfig>
  );
};
