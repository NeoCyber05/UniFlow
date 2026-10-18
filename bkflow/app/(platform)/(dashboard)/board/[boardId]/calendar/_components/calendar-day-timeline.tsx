"use client";

import { CalendarClock, CalendarPlus, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CalendarEntry } from "@/lib/calendar/calendar-entries";
import { getCalendarRange } from "@/lib/calendar/calendar-navigation";
import type { DayTimeline, TimelineGap, TimelineWork } from "@/lib/calendar/day-timeline";
import { cn } from "@/lib/utils";

import { WEEK_DAYS } from "../_lib/constants";
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

  if (hours === 0) return `${rest} phút`;

  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
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
    ? "Hạn nộp"
    : entry.kind === "checklist-deadline"
      ? "Hạn mục checklist"
      : "Bắt đầu (cũ)";

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
  // Lấy giữa trưa VN của từng ngày để key ngày không lệch theo múi giờ trình duyệt.
  const stripDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.parse(week.from) + index * 86_400_000 + 12 * 3_600_000);

    return { key: getGmt7DayKey(date), date: getGmt7Parts(date).date };
  });
  const rows = buildRows(timeline);
  const title = (cardId: string) => cardMeta[cardId]?.title ?? "Thẻ";
  const isEmpty = rows.length === 0 && timeline.allDay.length === 0;

  return (
    <aside
      aria-label="Dòng thời gian trong ngày"
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3"
    >
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Chọn ngày trong tuần">
        {stripDays.map((item, index) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.key === day}
            onClick={() => onSelectDay(item.key)}
            className={cn(
              "flex flex-col items-center rounded-md border px-1 py-1.5 text-[11px] font-semibold transition",
              item.key === day
                ? "border-violet-600 bg-violet-600 text-white"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100",
              item.key === today && item.key !== day && "border-violet-300 text-violet-700",
            )}
          >
            <span>{WEEK_DAYS[index]}</span>
            <span className="tabular-nums">{item.date}</span>
          </button>
        ))}
      </div>

      {timeline.allDay.length > 0 && (
        <section aria-label="Cả ngày" className="space-y-1">
          <h2 className="text-xs font-semibold uppercase text-neutral-500">Cả ngày</h2>
          {timeline.allDay.map((entry) => (
            <div
              key={entry.key}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs"
            >
              <button
                type="button"
                onClick={() => onOpenTask(entry.cardId)}
                className="min-w-0 flex-1 truncate text-left font-medium text-neutral-800"
              >
                <span className="mr-1 text-[10px] font-semibold uppercase text-neutral-500">
                  {entry.kind === "work-day" ? "Ngày làm" : "Hạn nộp"}
                </span>
                {title(entry.cardId)}
              </button>
              {entry.kind === "work-day" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => onPlanTask(entry.cardId)}
                >
                  Xếp giờ
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      <section aria-label="Lịch trong ngày" className="space-y-3 border-l-2 border-violet-200 pl-3">
        {rows.map((row) => {
          if (row.type === "gap") {
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-md border border-dashed border-neutral-300 px-2 py-1.5 text-xs text-neutral-600"
              >
                <span>
                  Trống {formatMinutes(row.gap.minutes)} ({timeOf(row.gap.startsAt)}-{timeOf(row.gap.endsAt)})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={() => onCreateInGap(row.gap)}
                >
                  <CalendarPlus className="h-3 w-3" />
                  Thêm thẻ
                </Button>
              </div>
            );
          }

          if (row.type === "marker") {
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => onOpenTask(row.entry.cardId)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-left text-xs text-orange-900",
                  cardMeta[row.entry.cardId]?.isCompleted && "opacity-60",
                )}
              >
                <Flag className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold tabular-nums">{timeOf(row.entry.startsAt!)}</span>
                <span className="shrink-0 text-[10px] font-semibold uppercase">{markerLabel(row.entry)}</span>
                <span className="truncate">{row.entry.title ?? title(row.entry.cardId)}</span>
              </button>
            );
          }

          const overlapping = row.works.length > 1;

          return (
            <div
              key={row.key}
              className={cn("space-y-1 rounded-md", overlapping && "border border-amber-300 bg-amber-50/60 p-1.5")}
              role={overlapping ? "group" : undefined}
              aria-label={overlapping ? `${row.works.length} buổi chồng lấn` : undefined}
            >
              {overlapping && (
                <p className="px-0.5 text-[10px] font-semibold uppercase text-amber-700">
                  Chồng lấn · {row.works.length} buổi
                </p>
              )}
              {row.works.map((work) => {
                const clippedMinutes = Math.round(
                  (Date.parse(work.clippedEnd) - Date.parse(work.clippedStart)) / 60_000,
                );

                return (
                  <div key={`${work.key}:${day}`} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenTask(work.cardId)}
                    className={cn(
                      "flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-left text-xs text-violet-900",
                      cardMeta[work.cardId]?.isCompleted && "opacity-60",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-semibold tabular-nums">
                        {timeOf(work.clippedStart)}-{endOf(work.clippedEnd, day)}
                      </span>
                      <span className="truncate">{title(work.cardId)}</span>
                    </span>
                    <span className="pl-5 text-[10px] text-violet-700">
                      {formatMinutes(work.durationMinutes)}
                      {clippedMinutes < work.durationMinutes ? " · đoạn trong ngày, buổi kéo dài sang ngày khác" : ""}
                    </span>
                  </button>
                  <Button type="button" variant="outline" size="sm" aria-label={`Xếp lịch ${title(work.cardId)}`} onClick={() => onPlanTask(work.cardId)}>Xếp lịch</Button>
                  </div>
                );
              })}
            </div>
          );
        })}

        {isEmpty && (
          <p className="rounded-md border border-dashed border-neutral-200 px-2 py-3 text-center text-xs text-neutral-500">
            Chưa có buổi làm hay hạn nộp trong ngày này.
          </p>
        )}
      </section>
    </aside>
  );
};
