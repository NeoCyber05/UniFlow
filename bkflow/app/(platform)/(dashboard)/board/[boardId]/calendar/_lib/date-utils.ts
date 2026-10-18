import { getCalendarRange, getTodayKey } from "@/lib/calendar/calendar-navigation";
import {
  DAY_VIEW_LABELS,
  DEFAULT_CREATE_HOUR,
  DEFAULT_CREATE_TIME,
  GMT7_OFFSET_MS,
  MIN_CREATE_DURATION_MINUTES,
  MIN_CREATE_DURATION_MS,
  MINUTES_IN_DAY,
  TIME_INPUT_PATTERN,
} from "./constants";

const getGridRange = (anchorDate: Date, mode: "month" | "week" | "day") => {
  const { from, to } = getCalendarRange(getTodayKey(anchorDate), mode);
  return { fromIso: from, toIso: to, days: Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) }, (_, index) => new Date(Date.parse(from) + index * 86_400_000)) };
};
export const getMonthGridRange = (anchorDate: Date) => getGridRange(anchorDate, "month");
export const getWeekGridRange = (anchorDate: Date) => getGridRange(anchorDate, "week");

export const getGmt7Parts = (date: Date) => {
  const shiftedDate = new Date(date.getTime() + GMT7_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    date: shiftedDate.getUTCDate(),
    day: shiftedDate.getUTCDay(),
    hours: shiftedDate.getUTCHours(),
    minutes: shiftedDate.getUTCMinutes(),
  };
};

export const getGmt7DayKey = (date: Date) => {
  const parts = getGmt7Parts(date);

  return [
    parts.year,
    String(parts.month + 1).padStart(2, "0"),
    String(parts.date).padStart(2, "0"),
  ].join("-");
};

export const getGmt7DateFromParts = (
  year: number,
  month: number,
  date: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
) => new Date(
  Date.UTC(year, month, date, hours, minutes, seconds, milliseconds) -
    GMT7_OFFSET_MS,
);

export const formatGmt7DateTimeInput = (date: Date) => {
  const parts = getGmt7Parts(date);

  return [
    [
      parts.year,
      String(parts.month + 1).padStart(2, "0"),
      String(parts.date).padStart(2, "0"),
    ].join("-"),
    [
      String(parts.hours).padStart(2, "0"),
      String(parts.minutes).padStart(2, "0"),
    ].join(":"),
  ].join("T");
};

export const parseGmt7DateTimeInput = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, date, hours, minutes] = match;
  const parsedDate = getGmt7DateFromParts(
    Number(year),
    Number(month) - 1,
    Number(date),
    Number(hours),
    Number(minutes),
  );

  if (Number.isNaN(parsedDate.getTime()) || formatGmt7DateTimeInput(parsedDate) !== value) {
    return null;
  }

  return parsedDate;
};

export const getDefaultCreateRangeForDay = (day: Date) => {
  const parts = getGmt7Parts(day);
  const startDate = getGmt7DateFromParts(
    parts.year,
    parts.month,
    parts.date,
    DEFAULT_CREATE_HOUR,
  );

  return {
    startDate,
    dueDate: new Date(startDate.getTime() + MIN_CREATE_DURATION_MS),
  };
};

export const getCreateRangeFromDayViewMinutes = (
  anchorDate: Date,
  anchorMinute: number,
  currentMinute: number,
) => {
  if (anchorMinute === currentMinute) {
    const startMinute = Math.min(
      Math.floor(anchorMinute / MIN_CREATE_DURATION_MINUTES) *
        MIN_CREATE_DURATION_MINUTES,
      MINUTES_IN_DAY - MIN_CREATE_DURATION_MINUTES,
    );
    const endMinute = startMinute + MIN_CREATE_DURATION_MINUTES;
    const { start } = getGmt7DayBoundary(anchorDate);

    return {
      startMinute,
      endMinute,
      startDate: new Date(start.getTime() + startMinute * 60_000),
      dueDate: new Date(start.getTime() + endMinute * 60_000),
    };
  }

  let startMinute = Math.min(anchorMinute, currentMinute);
  let endMinute = Math.max(anchorMinute, currentMinute);

  if (endMinute - startMinute < MIN_CREATE_DURATION_MINUTES) {
    if (currentMinute < anchorMinute) {
      startMinute = Math.max(0, endMinute - MIN_CREATE_DURATION_MINUTES);
    } else {
      endMinute = Math.min(
        MINUTES_IN_DAY,
        startMinute + MIN_CREATE_DURATION_MINUTES,
      );
    }
  }

  if (endMinute - startMinute < MIN_CREATE_DURATION_MINUTES) {
    startMinute = Math.max(0, MINUTES_IN_DAY - MIN_CREATE_DURATION_MINUTES);
    endMinute = MINUTES_IN_DAY;
  }

  const { start } = getGmt7DayBoundary(anchorDate);

  return {
    startMinute,
    endMinute,
    startDate: new Date(start.getTime() + startMinute * 60_000),
    dueDate: new Date(start.getTime() + endMinute * 60_000),
  };
};

export const getRoundedCreateRangeFromDayViewMinutes = (
  anchorDate: Date,
  anchorMinute: number,
  currentMinute: number,
) => {
  const rawStartMinute = Math.min(anchorMinute, currentMinute);
  const rawEndMinute = Math.max(anchorMinute, currentMinute);
  let startMinute =
    Math.floor(rawStartMinute / MIN_CREATE_DURATION_MINUTES) *
      MIN_CREATE_DURATION_MINUTES;
  let endMinute =
    Math.ceil(rawEndMinute / MIN_CREATE_DURATION_MINUTES) *
      MIN_CREATE_DURATION_MINUTES;

  startMinute = Math.min(
    Math.max(startMinute, 0),
    MINUTES_IN_DAY - MIN_CREATE_DURATION_MINUTES,
  );
  endMinute = Math.min(Math.max(endMinute, startMinute), MINUTES_IN_DAY);

  if (endMinute - startMinute < MIN_CREATE_DURATION_MINUTES) {
    endMinute = Math.min(
      MINUTES_IN_DAY,
      startMinute + MIN_CREATE_DURATION_MINUTES,
    );
  }

  if (endMinute - startMinute < MIN_CREATE_DURATION_MINUTES) {
    startMinute = Math.max(0, endMinute - MIN_CREATE_DURATION_MINUTES);
  }

  const { start } = getGmt7DayBoundary(anchorDate);

  return {
    startMinute,
    endMinute,
    startDate: new Date(start.getTime() + startMinute * 60_000),
    dueDate: new Date(start.getTime() + endMinute * 60_000),
  };
};

export const roundDayViewStartMinute = (minute: number) =>
  Math.min(
    Math.max(
      Math.floor(minute / MIN_CREATE_DURATION_MINUTES) *
        MIN_CREATE_DURATION_MINUTES,
      0,
    ),
    MINUTES_IN_DAY,
  );

export const roundDayViewEndMinute = (minute: number) =>
  Math.min(
    Math.max(
      Math.ceil(minute / MIN_CREATE_DURATION_MINUTES) *
        MIN_CREATE_DURATION_MINUTES,
      0,
    ),
    MINUTES_IN_DAY,
  );

export const getDayGridRange = (anchorDate: Date) => {
  const { year, month, date } = getGmt7Parts(anchorDate);
  const from = getGmt7DateFromParts(year, month, date, 0, 0, 0, 0);
  const to = getGmt7DateFromParts(year, month, date, 23, 59, 59, 999);

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    days: [from],
  };
};

export const getGmt7DayBoundary = (anchorDate: Date) => {
  const { year, month, date } = getGmt7Parts(anchorDate);
  const start = getGmt7DateFromParts(year, month, date, 0, 0, 0, 0);
  const end = getGmt7DateFromParts(year, month, date + 1, 0, 0, 0, 0);

  return { start, end };
};

export const formatDayTitle = (date: Date) => {
  const parts = getGmt7Parts(date);

  return `${DAY_VIEW_LABELS[parts.day]}, ${String(parts.date).padStart(2, "0")}/${String(parts.month + 1).padStart(2, "0")}/${parts.year}`;
};

export const getDayKey = (date: Date) => getGmt7DayKey(date);
export const formatCalendarTime = (date: Date) => formatGmt7Time(date);
export const formatCalendarDate = (date: Date) => {
  const p = getGmt7Parts(date);
  return `${String(p.date).padStart(2, "0")}/${String(p.month + 1).padStart(2, "0")}/${p.year}`;
};
export const formatCalendarDateTime = (date: Date) => `${formatCalendarDate(date)} ${formatGmt7Time(date)}`;
export const isSameCalendarMonth = (left: Date, right: Date) => {
  const a = getGmt7Parts(left), b = getGmt7Parts(right);
  return a.year === b.year && a.month === b.month;
};
export const isCalendarToday = (date: Date) => getDayKey(date) === getDayKey(new Date());

export const formatGmt7Time = (date: Date) => {
  const parts = getGmt7Parts(date);

  return `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
};

export const formatGmt7DateTime = (date: Date) => {
  const parts = getGmt7Parts(date);

  return [
    `${String(parts.date).padStart(2, "0")}/${String(parts.month + 1).padStart(2, "0")}/${parts.year}`,
    formatGmt7Time(date),
  ].join(" ");
};

export const getLocalDay = (date: Date) =>
  getGmt7DayBoundary(date).start;

export const compareDay = (left: Date, right: Date) =>
  getLocalDay(left).getTime() - getLocalDay(right).getTime();

export const parseCalendarDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const copyDateToDay = (sourceDate: Date, targetDay: Date) => {
  const target = getGmt7Parts(targetDay), source = getGmt7Parts(sourceDate);
  return getGmt7DateFromParts(target.year, target.month, target.date, source.hours, source.minutes, sourceDate.getUTCSeconds(), sourceDate.getUTCMilliseconds());
};
export const getDateWithPreservedTime = copyDateToDay;
/** The selected last occupied day precedes an exclusive midnight end by one day. */
export const copyRangeEndToDay = (end: Date, targetDay: Date) =>
  copyDateToDay(end, new Date(targetDay.getTime() + (getLocalDay(end).getTime() === end.getTime() ? 86_400_000 : 0)));
export const getDefaultDueDateForDay = (day: Date, timeValue = DEFAULT_CREATE_TIME) => {
  const match = TIME_INPUT_PATTERN.exec(timeValue);
  const p = getGmt7Parts(day);
  return getGmt7DateFromParts(p.year, p.month, p.date, match ? Number(match[1]) : DEFAULT_CREATE_HOUR, match ? Number(match[2]) : 0);
};

export const getReminderError = (dueDate: Date, reminder: string | null) => {
  if (!reminder || reminder === "none") {
    return null;
  }

  const offsetMinutes = parseInt(reminder, 10);

  if (Number.isNaN(offsetMinutes)) {
    return "Mốc nhắc nhở không hợp lệ.";
  }

  const triggerTime = dueDate.getTime() - offsetMinutes * 60_000;

  if (triggerTime >= Date.now()) {
    return null;
  }

  const minutesUntilDue = Math.floor((dueDate.getTime() - Date.now()) / 60_000);

  if (minutesUntilDue <= 0) {
    return "Thẻ đã hết hạn. Vui lòng kéo ngày hết hạn sang thời điểm hợp lệ.";
  }

  return "Thời gian nhắc nhở đã ở trong quá khứ. Hãy kéo ngày hết hạn xa hơn hoặc đổi mốc nhắc nhở.";
};
