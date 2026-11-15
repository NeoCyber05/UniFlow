import { getWeekdayIndex, getZonedTimeOnDay } from "@/lib/ai/assistant/time";

export type RoutineSchedule = { minuteOfDay: number; weekdays: number[]; timeZone: string };

/** Mốc chạy đầu tiên SAU `after` theo giờ địa phương; null nếu không lặp (weekdays rỗng). */
export const nextRoutineRun = ({ minuteOfDay, weekdays, timeZone }: RoutineSchedule, after: Date): Date | null => {
  // 0..7: hôm nay đến đúng thứ này tuần sau (khi giờ hôm nay đã qua).
  for (let day = 0; day <= 7; day++) {
    const at = getZonedTimeOnDay(after, timeZone, day, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
    if (at.getTime() > after.getTime() && weekdays.includes(getWeekdayIndex(at, timeZone))) return at;
  }
  return null;
};
