import {
  addVNDays,
  getStartOfVNDay,
  getVNDay,
  getVNDayKey,
  getVNWeekday,
  type VNDay,
} from "@/lib/my-tasks/vn-day";
import { z } from "zod";
import { emptyBoardFilters, type BoardFilterState } from "@/hooks/use-board-filters";
import { DateOnly } from "@/lib/cards/task-schedule";

export type CalendarMode = "month" | "week" | "day";

const filtersSchema = z.object({
  selectedListIds: z.array(z.string().max(200)).max(100),
  selectedMemberIds: z.array(z.string().max(200)).max(100),
  selectedDueDateFilters: z.array(z.string().max(200)).max(100),
  selectedLabelIds: z.array(z.string().max(200)).max(100),
  selectedCourseIds: z.array(z.string().max(200)).max(100),
  myWorkEnabled: z.boolean(), noMembersEnabled: z.boolean(),
  completedEnabled: z.boolean(), notCompletedEnabled: z.boolean(),
  noLabelsEnabled: z.boolean(), importantOnly: z.boolean(),
});

export const readCalendarLocation = (params: URLSearchParams, now = new Date()) => {
  const date = params.get("date");
  const validDate = DateOnly.safeParse(date);
  const view = params.get("view");
  let filters: BoardFilterState | null = null;
  try {
    const parsed = filtersSchema.safeParse(JSON.parse(params.get("calendarFilters") ?? "null"));
    if (parsed.success) filters = parsed.data;
  } catch { /* Invalid URL filter JSON falls back to the current board filters. */ }
  return { day: date && validDate.success ? date : getTodayKey(now), mode: (view === "day" || view === "week" ? view : "month") as CalendarMode, filters };
};

export const writeCalendarLocation = (params: URLSearchParams, value: { day: string; mode: CalendarMode; filters?: BoardFilterState }) => {
  const next = new URLSearchParams(params);
  next.set("date", value.day);
  next.set("view", value.mode);
  if (value.filters) next.set("calendarFilters", JSON.stringify({ ...emptyBoardFilters, ...value.filters }));
  return next;
};

const parseDayKey = (key: string): VNDay => {
  const [year, month, day] = key.split("-").map(Number);

  return { year, month: month - 1, day };
};

const startOfWeek = (value: VNDay) => addVNDays(value, -((getVNWeekday(value) + 6) % 7));

/** Range ngày VN; `to` là biên mở (đầu ngày kế sau range). */
export const getCalendarRange = (day: string, mode: CalendarMode): { from: string; to: string } => {
  const current = parseDayKey(day);
  let first = current;
  let after = addVNDays(current, 1);

  if (mode === "week") {
    first = startOfWeek(current);
    after = addVNDays(first, 7);
  } else if (mode === "month") {
    first = startOfWeek({ ...current, day: 1 });
    const lastOfMonth = { year: current.year, month: current.month + 1, day: 0 };
    const last = new Date(Date.UTC(lastOfMonth.year, lastOfMonth.month, 0));
    after = addVNDays(
      startOfWeek({ year: last.getUTCFullYear(), month: last.getUTCMonth(), day: last.getUTCDate() }),
      7,
    );
  }

  return {
    from: getStartOfVNDay(first).toISOString(),
    to: getStartOfVNDay(after).toISOString(),
  };
};

export const getTodayKey = (now: Date = new Date()) => getVNDayKey(getVNDay(now));

/** Bước trước/sau theo view, giữ ngày đang chọn hợp lệ (31/01 + 1 tháng = 28/02). */
export const shiftCalendarDay = (day: string, mode: CalendarMode, delta: number) => {
  const current = parseDayKey(day);

  if (mode === "day") return getVNDayKey(addVNDays(current, delta));
  if (mode === "week") return getVNDayKey(addVNDays(current, delta * 7));

  const target = new Date(Date.UTC(current.year, current.month + delta, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();

  return getVNDayKey({
    year: target.getUTCFullYear(),
    month: target.getUTCMonth(),
    day: Math.min(current.day, lastDay),
  });
};

/** Giao khoảng nửa mở: start < to && end > from. */
export const intersectsRange = (range: { from: string; to: string }, startsAt: string, endsAt: string) =>
  Date.parse(startsAt) < Date.parse(range.to) && Date.parse(endsAt) > Date.parse(range.from);
