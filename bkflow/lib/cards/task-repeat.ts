import { z } from "zod";

import { getZonedDayKey, zonedTimeToIso } from "@/lib/capture/analysis";
import type { TaskDeadline } from "@/lib/cards/task-schedule";

export const REPEAT_UNITS = ["day", "weekday", "week", "month", "year"] as const;
export type RepeatUnit = (typeof REPEAT_UNITS)[number];

export const TaskRepeatSchema = z.object({
  unit: z.enum(REPEAT_UNITS),
  every: z.number().int().min(1).max(99),
});
export type TaskRepeat = z.infer<typeof TaskRepeatSchema>;

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY = 24 * 60 * 60 * 1000;

const UNIT_LABEL: Record<Exclude<RepeatUnit, "weekday">, [single: string, many: string]> = {
  day: ["Hằng ngày", "ngày"],
  week: ["Hằng tuần", "tuần"],
  month: ["Hằng tháng", "tháng"],
  year: ["Hằng năm", "năm"],
};

export const formatRepeat = (repeat: TaskRepeat) => {
  if (repeat.unit === "weekday") return "Ngày trong tuần";
  const [single, many] = UNIT_LABEL[repeat.unit];
  return repeat.every === 1 ? single : `Mỗi ${repeat.every} ${many}`;
};

/** Đọc cặp cột repeatUnit/repeatEvery của Card; dữ liệu lạ coi như không lặp. */
export const readCardRepeat = (card: { repeatUnit: string | null; repeatEvery: number | null }): TaskRepeat | null => {
  const parsed = TaskRepeatSchema.safeParse({ unit: card.repeatUnit, every: card.repeatEvery ?? 1 });
  return parsed.success ? parsed.data : null;
};

const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fromKey = (key: string) => Date.parse(`${key}T00:00:00Z`);

/** Cộng tháng giữ ngày, kẹt về cuối tháng nếu tháng đích ngắn hơn (31/1 + 1 tháng = 28/2). */
const addMonths = (key: string, months: number) => {
  const [year, month, day] = key.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toKey(target.getTime());
};

const step = (key: string, repeat: TaskRepeat) => {
  switch (repeat.unit) {
    case "day": return toKey(fromKey(key) + repeat.every * DAY);
    case "week": return toKey(fromKey(key) + repeat.every * 7 * DAY);
    case "month": return addMonths(key, repeat.every);
    case "year": return addMonths(key, repeat.every * 12);
    case "weekday": {
      let next = fromKey(key) + DAY;
      while ([0, 6].includes(new Date(next).getUTCDay())) next += DAY;
      return toKey(next);
    }
  }
};

/**
 * Hạn của lần lặp kế tiếp, giữ nguyên giờ (VN) nếu hạn có giờ.
 * Tính từ hạn cũ; việc đã trễ nhiều kỳ thì nhảy tới kỳ đầu tiên từ hôm nay trở đi.
 */
export const nextRepeatDeadline = (deadline: TaskDeadline, repeat: TaskRepeat, now: Date = new Date()): TaskDeadline => {
  const baseKey = deadline.dueDate ? getZonedDayKey(deadline.dueDate, TIME_ZONE) : deadline.deadlineOn ?? getZonedDayKey(now.toISOString(), TIME_ZONE);
  const today = getZonedDayKey(now.toISOString(), TIME_ZONE);
  let key = step(baseKey, repeat);
  while (key < today) key = step(key, repeat);
  if (!deadline.dueDate) return { dueDate: null, deadlineOn: key };
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(deadline.dueDate));
  const dueDate = zonedTimeToIso(key, time, TIME_ZONE);
  return dueDate ? { dueDate, deadlineOn: null } : { dueDate: null, deadlineOn: key };
};
