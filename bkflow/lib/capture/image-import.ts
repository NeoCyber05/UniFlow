import { z } from "zod";

import { DateOnly } from "@/lib/cards/task-schedule";

/** Ảnh gửi lên AI: data URL đã nén ở client (~1600px JPEG). */
export const IMAGE_DATA_URL_MAX_LENGTH = 6_000_000;
export const IMAGE_IMPORT_TIME_ZONE = "Asia/Ho_Chi_Minh";

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Giờ dạng HH:mm." });
const text = (max: number) => z.string().trim().max(max);

export const TimetableSession = z.object({
  code: text(20).nullable(),
  name: text(120).min(1, { message: "Thiếu tên môn." }),
  /** 1 = Thứ 2 … 6 = Thứ 7, 7 = Chủ nhật */
  weekday: z.number().int().min(1).max(7),
  start: HHMM,
  end: HHMM,
  room: text(40).nullable(),
  /** Như trên TKB: "2-9,11-18" hoặc "6,7,8" */
  weeks: text(80).min(1, { message: "Thiếu tuần học." }),
  /** LT / BT / TN… */
  note: text(20).nullable(),
});
export type TimetableSession = z.infer<typeof TimetableSession>;

export const ImageTaskItem = z.object({
  title: text(200).min(1, { message: "Thiếu tiêu đề." }),
  /** TASK: việc có hạn; EVENT: lịch để xem (họp, thi, buổi học) */
  kind: z.enum(["TASK", "EVENT"]),
  date: DateOnly.nullable(),
  start: HHMM.nullable(),
  end: HHMM.nullable(),
  courseCode: text(20).nullable(),
  description: text(1_000).nullable(),
});
export type ImageTaskItem = z.infer<typeof ImageTaskItem>;

export type ImageAnalysis =
  | { type: "timetable"; sessions: TimetableSession[] }
  | { type: "tasks"; items: ImageTaskItem[] };

export const WEEKDAY_LABELS = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

const MAX_WEEK = 60;

/** "2-9,11-18" → [2..9, 11..18]. Phần sai bỏ qua; chuỗi không đọc được → []. */
export const parseWeeks = (value: string): number[] => {
  const weeks = new Set<number>();
  for (const part of value.split(/[,;\s]+/).filter(Boolean)) {
    const match = part.match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
    if (!match) continue;
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (from < 1 || to > MAX_WEEK || from > to) continue;
    for (let week = from; week <= to; week += 1) weeks.add(week);
  }
  return [...weeks].sort((a, b) => a - b);
};

export const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Thứ Hai của tuần chứa ngày (YYYY-MM-DD). */
export const mondayOf = (day: string) => {
  const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay(); // 0 = CN
  return addDays(day, -((weekday + 6) % 7));
};

/** Mỗi buổi học cụ thể: tuần w, thứ d → week1Monday + (w-1)*7 + (d-1) ngày. */
export const expandTimetable = (sessions: TimetableSession[], week1Monday: string) =>
  sessions.flatMap((session) =>
    parseWeeks(session.weeks).map((week) => ({
      session,
      week,
      date: addDays(week1Monday, (week - 1) * 7 + (session.weekday - 1)),
    })),
  );
