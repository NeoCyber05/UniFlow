"use client";

import { CalendarCheck, CalendarClock, CalendarPlus, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CalendarEntry } from "@/lib/calendar/calendar-entries";
import { getCalendarRange } from "@/lib/calendar/calendar-navigation";
import type { DayTimeline, TimelineGap, TimelineWork } from "@/lib/calendar/day-timeline";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { getWeekDays } from "../_lib/constants";
import { formatGmt7Time, getGmt7DayKey, getGmt7Parts } from "../_lib/date-utils";

type CardMeta = Record<string, { title: string; isCompleted: boolean }>;

type CalendarDayTimelineProps = {
  day: string;
  today: string;
  timeline: DayTimeline;
  cardMeta: CardMeta;
  onOpenTask: (cardId: string) => void;
  onSelectDay: (day: string) => void;
  /** Mở bộ chọn ngày/giờ làm cho thẻ; renderer không ghi task. */
  onPlanTask: (cardId: string) => void;
  onCreateInGap: (gap: TimelineGap) => void;
};

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return tr("calendar.duration.minutes", { minutes: rest });

  return rest === 0
    ? tr("calendar.duration.hours", { hours })
    : tr("calendar.duration.hoursMinutes", { hours, minutes: rest });
};

const timeOf = (iso: string) => formatGmt7Time(new Date(iso));

/** Đoạn kết thúc đúng nửa đêm in 24:00 thay vì 00:00 của ngày kế. */
const endOf = (iso: string, day: string) =>
  getGmt7DayKey(new Date(Date.parse(iso) - 1)) === day && timeOf(iso) === "00:00" ? "24:00" : timeOf(iso);

type Row =
  | { at: number; key: string; type: "group"; works: TimelineWork[] }
  | { at: number; key: string; type: "gap"; gap: TimelineGap }
  | { at: number; key: string; type: "marker"; entry: CalendarEntry };

const buildRows = (timeline: DayTimeline): Row[] => {
  const groups = new Map<number, TimelineWork[]>();

  for (const work of timeline.work) {
    groups.set(work.overlapGroup, [...(groups.get(work.overlapGroup) ?? []), work]);
  }

  return [
    ...[...groups.entries()].map<Row>(([group, works]) => ({
      at: Date.parse(works[0].clippedStart),
      key: `group:${group}`,
      type: "group",
      works,
    })),
    ...timeline.gaps.map<Row>((gap) => ({ at: Date.parse(gap.startsAt), key: `gap:${gap.startsAt}`, type: "gap", gap })),
    ...timeline.markers.map<Row>((entry) => ({ at: Date.parse(entry.startsAt!), key: entry.key, type: "marker", entry })),
  ].sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1));
};

const markerLabel = (entry: CalendarEntry) =>
  entry.kind === "deadline"
    ? tr("calendar.occurrence.deadline")
    : entry.kind === "checklist-deadline"
      ? tr("calendar.marker.checklistDeadline")
      : tr("calendar.marker.legacyStart");

export const CalendarDayTimeline = ({
  day,
  today,
  timeline,
  cardMeta,
  onOpenTask,
  onSelectDay,
  onPlanTask,
  onCreateInGap,
}: CalendarDayTimelineProps) => {
  const week = getCalendarRange(day, "week");
  const weekDays = getWeekDays();
  // Lấy giữa trưa VN của từng ngày để key ngày không lệch theo múi giờ trình duyệt.
  const stripDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.parse(week.from) + index * 86_400_000 + 12 * 3_600_000);

    return { key: getGmt7DayKey(date), date: getGmt7Parts(date).date };
  });
  const rows = buildRows(timeline);
  const title = (cardId: string) => cardMeta[cardId]?.title ?? tr("calendar.common.cardFallback");
  const isEmpty = rows.length === 0 && timeline.allDay.length === 0;

  const workCount = timeline.work.length;
  const markerCount = timeline.markers.length + timeline.allDay.filter((entry) => entry.kind !== "work-day").length;
  const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60";

  return (
    <aside
      aria-label={tr("calendar.dayTimeline.asideAria")}
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs lg:sticky lg:top-0"
    >
      <header className="space-y-3 border-b border-neutral-100 px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{tr("calendar.dayTimeline.title")}</h2>
          <p className="text-xs text-neutral-500">
            {tr("calendar.dayTimeline.summary", { workCount, markerCount })}
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1" role="group" aria-label={tr("calendar.dayTimeline.weekPickerAria")}>
          {stripDays.map((item, index) => {
            const isSelected = item.key === day;
            const isToday = item.key === today;

            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                onClick={() => onSelectDay(item.key)}
                className={cn("group flex flex-col items-center gap-1 rounded-lg py-1.5 transition-colors hover:bg-neutral-50", focusRing)}
              >
                <span className={cn("text-[10px] font-medium uppercase", isToday ? "text-violet-600" : "text-neutral-400")}>
                  {weekDays[index]}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors",
                    isSelected
                      ? "bg-violet-600 text-white shadow-sm"
                      : isToday
                        ? "bg-violet-50 text-violet-700"
                        : "text-neutral-700 group-hover:bg-neutral-100",
                  )}
                >
                  {item.date}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {timeline.allDay.length > 0 && (
        <section aria-label={tr("calendar.dayTimeline.allDay")} className="space-y-1.5 border-b border-neutral-100 px-4 py-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{tr("calendar.dayTimeline.allDay")}</h3>
          {timeline.allDay.map((entry) => (
            <div
              key={entry.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border-l-[3px] py-1.5 pl-2.5 pr-1.5",
                entry.kind === "work-day" ? "border-l-violet-500 bg-violet-50/70" : "border-l-orange-500 bg-orange-50/70",
              )}
            >
              <button
                type="button"
                onClick={() => onOpenTask(entry.cardId)}
                className={cn("min-w-0 flex-1 rounded text-left", focusRing)}
              >
                <span className="block text-[11px] font-medium text-neutral-500">
                  {entry.kind === "work-day" ? tr("calendar.dayTimeline.workDay") : tr("calendar.occurrence.deadline")}
                </span>
                <span className="block truncate text-sm font-medium text-neutral-900">{title(entry.cardId)}</span>
              </button>
              {entry.kind === "work-day" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs text-violet-700 hover:bg-violet-100 hover:text-violet-800"
                  onClick={() => onPlanTask(entry.cardId)}
                >
                  {tr("calendar.dayTimeline.setTime")}
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      <ol aria-label={tr("calendar.dayTimeline.listAria")} className="space-y-2 px-4 py-3">
        {rows.map((row) => {
          if (row.type === "gap") {
            return (
              <li key={row.key} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2">
                <span className="text-[11px] tabular-nums text-neutral-400">{timeOf(row.gap.startsAt)}</span>
                <button
                  type="button"
                  onClick={() => onCreateInGap(row.gap)}
                  className={cn(
                    "group flex items-center justify-between gap-2 rounded-lg border border-dashed border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-500 transition-colors hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700",
                    focusRing,
                  )}
                >
                  <span className="truncate">
                    {tr("calendar.dayTimeline.freeSlot", { duration: formatMinutes(row.gap.minutes) })}
                    <span className="text-neutral-400"> · {tr("calendar.dayTimeline.untilTime", { time: timeOf(row.gap.endsAt) })}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-medium text-violet-600">
                    <CalendarPlus aria-hidden className="h-3.5 w-3.5" />
                    {tr("calendar.dayTimeline.addCard")}
                  </span>
                </button>
              </li>
            );
          }

          if (row.type === "marker") {
            return (
              <li key={row.key} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2">
                <span className="pt-2 text-xs font-medium tabular-nums text-neutral-700">{timeOf(row.entry.startsAt!)}</span>
                <button
                  type="button"
                  onClick={() => onOpenTask(row.entry.cardId)}
                  className={cn(
                    "flex min-w-0 items-start gap-2 rounded-lg border-l-[3px] border-l-orange-500 bg-orange-50/70 px-2.5 py-1.5 text-left transition-colors hover:bg-orange-50",
                    focusRing,
                    cardMeta[row.entry.cardId]?.isCompleted && "opacity-60",
                  )}
                >
                  <Flag aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium text-orange-700">{markerLabel(row.entry)}</span>
                    <span className="block truncate text-sm font-medium text-neutral-900">
                      {row.entry.title ?? title(row.entry.cardId)}
                    </span>
                  </span>
                </button>
              </li>
            );
          }

          const overlapping = row.works.length > 1;

          return (
            <li
              key={row.key}
              className={cn("space-y-1.5", overlapping && "rounded-lg bg-amber-50/70 p-1.5 ring-1 ring-amber-200")}
              role={overlapping ? "group" : undefined}
              aria-label={overlapping ? tr("calendar.dayTimeline.overlapAria", { count: row.works.length }) : undefined}
            >
              {overlapping && (
                <p className="px-1 text-[11px] font-semibold text-amber-700">
                  {tr("calendar.dayTimeline.overlapBanner", { count: row.works.length })}
                </p>
              )}
              {row.works.map((work) => {
                const clippedMinutes = Math.round(
                  (Date.parse(work.clippedEnd) - Date.parse(work.clippedStart)) / 60_000,
                );

                return (
                  <div key={`${work.key}:${day}`} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2">
                    <span className="pt-2 text-xs font-medium tabular-nums text-neutral-700">{timeOf(work.clippedStart)}</span>
                    <div
                      className={cn(
                        "group flex min-w-0 items-start gap-1 rounded-lg border-l-[3px] border-l-violet-500 bg-violet-50/70 py-1.5 pl-2.5 pr-1 transition-colors hover:bg-violet-50",
                        cardMeta[work.cardId]?.isCompleted && "opacity-60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenTask(work.cardId)}
                        className={cn("min-w-0 flex-1 rounded text-left", focusRing)}
                      >
                        <span className="block truncate text-sm font-medium text-neutral-900">{title(work.cardId)}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500">
                          <CalendarClock aria-hidden className="h-3 w-3 shrink-0 text-violet-500" />
                          <span className="tabular-nums">
                            {timeOf(work.clippedStart)} – {endOf(work.clippedEnd, day)}
                          </span>
                          · {formatMinutes(work.durationMinutes)}
                        </span>
                        {clippedMinutes < work.durationMinutes && (
                          <span className="mt-0.5 block text-[11px] text-neutral-400">{tr("calendar.dayTimeline.spansAnotherDay")}</span>
                        )}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={tr("calendar.dayTimeline.scheduleCardAria", { title: title(work.cardId) })}
                        className="h-7 shrink-0 px-2 text-xs text-violet-700 hover:bg-violet-100 hover:text-violet-800"
                        onClick={() => onPlanTask(work.cardId)}
                      >
                        {tr("calendar.action.schedule")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </li>
          );
        })}

        {isEmpty && (
          <li className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100">
              <CalendarCheck aria-hidden className="h-5 w-5 text-neutral-400" />
            </span>
            <p className="text-sm font-medium text-neutral-700">{tr("calendar.dayTimeline.emptyTitle")}</p>
            <p className="text-xs text-neutral-500">{tr("calendar.dayTimeline.emptyDesc")}</p>
          </li>
        )}
      </ol>
    </aside>
  );
};
