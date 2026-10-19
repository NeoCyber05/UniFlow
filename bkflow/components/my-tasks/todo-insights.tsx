"use client";

import { useMemo } from "react";
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

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const RING_RADIUS = 30;

type TodoInsightsProps = {
  boardId: string;
  groups: MyTaskGroup[];
};

export const TodoInsights = ({ boardId, groups }: TodoInsightsProps) => {
  const setSelectedCourses = useBoardFilters((state) => state.setSelectedCourses);
  const progressSpring = useTempoTransition(spring.progress);
  const barSpring = useTempoTransition(spring.number);

  const stats = useMemo(() => {
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
        weekday: WEEKDAY_LABELS[getVNWeekday(day)],
        date: day.day,
        count: countByDay.get(getVNDayKey(day)) ?? 0,
      };
    });

    const courseMap = new Map<string, { id: string; label: string; dot: string; count: number }>();
    for (const task of pending) {
      const id = task.course?.id ?? PERSONAL_COURSE_FILTER;
      const entry = courseMap.get(id) ?? {
        id,
        label: task.course ? getCourseShortLabel(task.course) : "Cá nhân",
        dot: task.course ? getCourseColor(task.course.color).dot : "bg-neutral-300",
        count: 0,
      };
      entry.count += 1;
      courseMap.set(id, entry);
    }
    const courses = [...courseMap.values()].sort((a, b) => b.count - a.count);

    return { doneToday, total: doneToday + dueToday, next, days, courses };
  }, [groups]);

  const ratio = stats.total === 0 ? 0 : stats.doneToday / stats.total;
  const maxCourseCount = Math.max(1, ...stats.courses.map((course) => course.count));
  const nextDue = stats.next ? getTaskDeadlineAt(stats.next) : null;

  return (
    <ReducedMotionConfig>
      <aside className="flex flex-col gap-3">
        {/* Tiến độ hôm nay: đã xong / (đã xong + quá hạn + hôm nay) */}
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-[76px] w-[76px] shrink-0">
              <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
                <circle cx="38" cy="38" r={RING_RADIUS} fill="none" strokeWidth="8" className="stroke-neutral-200" />
                <motion.circle
                  cx="38"
                  cy="38"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="stroke-violet-600"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: ratio, opacity: ratio === 0 ? 0 : 1 }}
                  transition={progressSpring}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-neutral-900">
                {Math.round(ratio * 100)}%
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900">Hôm nay</h3>
              <p className="text-xs text-neutral-500">
                {stats.total === 0
                  ? "Không có việc đến hạn hôm nay"
                  : `${stats.doneToday}/${stats.total} việc đã xong`}
              </p>
              {stats.next && (
                <p className="mt-2 line-clamp-2 text-xs text-neutral-600">
                  <span className="font-semibold text-neutral-800">Tiếp theo:</span> {stats.next.title}
                  {nextDue && (
                    <span className="text-neutral-500">
                      {" "}· {nextDue.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 7 ngày tới */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900">7 ngày tới</h3>
            <Link
              href={`/board/${boardId}/calendar`}
              className="flex items-center gap-1 text-xs font-semibold text-violet-700 transition-colors duration-200 hover:text-violet-900"
            >
              Mở Lịch <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {stats.days.map((day, index) => (
              <div
                key={day.key}
                title={day.count > 0 ? `${day.count} việc đến hạn` : "Không có việc"}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl py-2",
                  index === 0 ? "bg-violet-600 text-white" : "bg-neutral-50 text-neutral-800",
                )}
              >
                <span className={cn("text-[10px] font-semibold", index === 0 ? "text-violet-100" : "text-neutral-500")}>
                  {day.weekday}
                </span>
                <span className="text-sm font-bold tabular-nums">{day.date}</span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {Array.from({ length: Math.min(day.count, 3) }, (_, dot) => (
                    <span key={dot} className={cn("h-1 w-1 rounded-full", index === 0 ? "bg-white" : "bg-violet-500")} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Theo môn học: bấm để lọc nhanh */}
        {stats.courses.length > 0 && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-bold text-neutral-900">Theo môn học</h3>
            <div className="flex flex-col">
              {stats.courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setSelectedCourses(boardId, [course.id])}
                  title={`Chỉ xem ${course.label}`}
                  className="-mx-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 hover:bg-neutral-50"
                >
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", course.dot)} />
                    <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">{course.label}</span>
                    <span className="text-xs tabular-nums text-neutral-500">{course.count} việc</span>
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
