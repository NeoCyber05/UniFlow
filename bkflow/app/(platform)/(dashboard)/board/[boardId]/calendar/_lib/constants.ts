import { tr } from "@/lib/i18n";
import type { CalendarMessageKey } from "@/lib/i18n/messages/vi-calendar";


const WEEK_DAY_KEYS: readonly CalendarMessageKey[] = [
  "calendar.weekday.short.mon",
  "calendar.weekday.short.tue",
  "calendar.weekday.short.wed",
  "calendar.weekday.short.thu",
  "calendar.weekday.short.fri",
  "calendar.weekday.short.sat",
  "calendar.weekday.short.sun",
];

const DAY_VIEW_LABEL_KEYS: readonly CalendarMessageKey[] = [
  "calendar.weekday.long.sun",
  "calendar.weekday.long.mon",
  "calendar.weekday.long.tue",
  "calendar.weekday.long.wed",
  "calendar.weekday.long.thu",
  "calendar.weekday.long.fri",
  "calendar.weekday.long.sat",
];

export const getWeekDays = () => WEEK_DAY_KEYS.map((key) => tr(key));
export const getDayViewLabels = () => DAY_VIEW_LABEL_KEYS.map((key) => tr(key));
export const GMT7_OFFSET_MINUTES = 7 * 60;
export const GMT7_OFFSET_MS = GMT7_OFFSET_MINUTES * 60 * 1000;
export const MINUTES_IN_DAY = 24 * 60;
export const MONTH_VISIBLE_DESKTOP = 3;
export const MONTH_VISIBLE_MOBILE = 2;
export const MONTH_RANGE_LANES = 2;
export const WEEK_RANGE_LANES = 4;
export const RANGE_LANE_HEIGHT = 28;
export const RANGE_LANE_GAP = 4;
export const WEEK_VISIBLE_DESKTOP = 8;
export const WEEK_VISIBLE_MOBILE = 4;
export const DAY_LANE_GAP_PX = 4;
export const MAX_DAY_LANES = 4;
export const MAX_MOBILE_DAY_LANES = 3;
export const DAY_FLOATING_CARD_BLOCK_MINUTES = 30;
export const MIN_CREATE_DURATION_MINUTES = 15;
export const MIN_CREATE_DURATION_MS = MIN_CREATE_DURATION_MINUTES * 60_000;
export const DAY_TIME_SLOTS = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return {
    index,
    hour,
    minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    isHour: minute === 0,
  };
});
export const DEFAULT_CREATE_HOUR = 9;
export const DEFAULT_CREATE_TIME = `${String(DEFAULT_CREATE_HOUR).padStart(2, "0")}:00`;
export const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
