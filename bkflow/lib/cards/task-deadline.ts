import type { Prisma } from "@prisma/client";

import type { TaskDeadline } from "@/lib/cards/task-schedule";
import { getEndOfVNDay, getStartOfVNDay, getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";

type DeadlineInput = { dueDate: Date | string | null; deadlineOn?: string | null };

const REMINDER_HOUR_VN = 9;

const parseDay = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month - 1, day };
};

/** Mốc hạn dạng thời điểm: dueDate, hoặc 23:59:59.999 VN của ngày hạn chỉ-ngày. */
export const getTaskDeadlineAt = (deadline: DeadlineInput): Date | null => {
  if (deadline.dueDate) return new Date(deadline.dueDate);
  if (deadline.deadlineOn) return getEndOfVNDay(parseDay(deadline.deadlineOn));
  return null;
};

export const getTaskDeadlineStatus = (
  deadline: DeadlineInput,
  now: Date,
): "none" | "upcoming" | "overdue" => {
  const at = getTaskDeadlineAt(deadline);
  if (!at) return "none";
  return at.getTime() < now.getTime() ? "overdue" : "upcoming";
};

/** Hạn chỉ-ngày nhắc theo 09:00 VN của ngày hạn trừ offset; ngày làm không phải hạn. */
export const getTaskReminderAt = (deadline: TaskDeadline, offsetMinutes: number): Date | null => {
  const base = deadline.dueDate
    ? new Date(deadline.dueDate)
    : deadline.deadlineOn
      ? new Date(getStartOfVNDay(parseDay(deadline.deadlineOn)).getTime() + REMINDER_HOUR_VN * 3_600_000)
      : null;
  return base ? new Date(base.getTime() - offsetMinutes * 60_000) : null;
};

const toDateColumn = (instant: Date) => new Date(`${getVNDayKey(getVNDay(new Date(instant.getTime())))}T00:00:00.000Z`);

/**
 * Where cho cả hai dạng hạn. Cột deadlineOn (SQL DATE) so theo ngày VN của mốc, không so với timestamp UTC.
 * shortcut: lte/gte chính xác khi mốc là cuối/đầu ngày VN (cách các caller dùng), upgrade nếu cần mốc giữa ngày.
 */
export const deadlineConditions = (range: { gte?: Date; lte?: Date; lt?: Date }): Prisma.CardWhereInput[] => {
  const dueDate: Prisma.DateTimeNullableFilter = {};
  const deadlineOn: Prisma.DateTimeNullableFilter = {};
  for (const key of ["gte", "lte", "lt"] as const) {
    const value = range[key];
    if (!value) continue;
    dueDate[key] = value;
    deadlineOn[key] = toDateColumn(value);
  }
  return [{ dueDate }, { deadlineOn }];
};

export const deadlineWhere = (range: { gte?: Date; lte?: Date; lt?: Date }): Prisma.CardWhereInput => ({
  OR: deadlineConditions(range),
});

export const hasDeadlineWhere: Prisma.CardWhereInput = {
  OR: [{ dueDate: { not: null } }, { deadlineOn: { not: null } }],
};

export const noDeadlineWhere: Prisma.CardWhereInput = { dueDate: null, deadlineOn: null };

