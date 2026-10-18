import { addVNDays, getStartOfVNDay } from "@/lib/my-tasks/vn-day";

import type { CalendarEntry } from "./calendar-entries";

export type TimelineWork = {
  key: string;
  cardId: string;
  /** Đoạn đã cắt theo biên ngày VN; dữ liệu gốc không đổi. */
  clippedStart: string;
  clippedEnd: string;
  /** Cụm chồng lấn (cùng số = cùng cụm). */
  overlapGroup: number;
  /** Thời lượng gốc của buổi, không phải của đoạn cắt. */
  durationMinutes: number;
};

export type TimelineGap = { startsAt: string; endsAt: string; minutes: number };

export type DayTimeline = {
  work: TimelineWork[];
  markers: CalendarEntry[];
  allDay: CalendarEntry[];
  gaps: TimelineGap[];
};

const MINUTE = 60_000;

/** Chỉ buổi `work` chiếm thời gian và tham gia gap/overlap; mọi marker chỉ để hiển thị. */
export const buildDayTimeline = (entries: CalendarEntry[], day: string): DayTimeline => {
  const [year, month, date] = day.split("-").map(Number);
  const dayStart = getStartOfVNDay({ year, month: month - 1, day: date }).getTime();
  const dayEnd = getStartOfVNDay(addVNDays({ year, month: month - 1, day: date }, 1)).getTime();
  const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

  const segments = entries.flatMap((entry) => {
    if (entry.kind !== "work" || !entry.startsAt || !entry.endsAt) return [];
    const start = Date.parse(entry.startsAt);
    const end = Date.parse(entry.endsAt);
    // Nửa mở [start, end): buổi hết đúng 00:00 không thuộc ngày kế.
    if (!(end > start) || end <= dayStart || start >= dayEnd) return [];

    return [{
      key: entry.key,
      cardId: entry.cardId,
      start: Math.max(start, dayStart),
      end: Math.min(end, dayEnd),
      durationMinutes: Math.round((end - start) / MINUTE),
    }];
  }).sort((a, b) => a.start - b.start || byKey(a, b));

  const work: TimelineWork[] = [];
  const gaps: TimelineGap[] = [];
  let group = -1;
  let groupEnd = -Infinity;

  for (const segment of segments) {
    if (segment.start >= groupEnd) {
      // Chỉ sinh gap giữa hai cụm, không suy ra đầu/cuối ngày rảnh.
      if (group >= 0 && segment.start > groupEnd) {
        gaps.push({
          startsAt: new Date(groupEnd).toISOString(),
          endsAt: new Date(segment.start).toISOString(),
          minutes: Math.round((segment.start - groupEnd) / MINUTE),
        });
      }
      group += 1;
      groupEnd = segment.end;
    } else {
      groupEnd = Math.max(groupEnd, segment.end);
    }

    work.push({
      key: segment.key,
      cardId: segment.cardId,
      clippedStart: new Date(segment.start).toISOString(),
      clippedEnd: new Date(segment.end).toISOString(),
      overlapGroup: group,
      durationMinutes: segment.durationMinutes,
    });
  }

  const markers = entries
    .filter((entry) => {
      if (entry.kind === "work" || entry.kind === "work-day" || entry.kind === "deadline-day" || !entry.startsAt) return false;
      const at = Date.parse(entry.startsAt);

      return at >= dayStart && at < dayEnd;
    })
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!) || byKey(a, b));
  const allDay = entries
    .filter((entry) => entry.day === day && (entry.kind === "work-day" || entry.kind === "deadline-day"))
    .sort(byKey);

  return { work, markers, allDay, gaps };
};
