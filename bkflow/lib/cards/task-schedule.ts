import { z } from "zod";

export type TaskSchedule = {
  scheduledOn: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
};

export type TaskDeadline = {
  dueDate: string | null;
  deadlineOn: string | null;
};

/** YYYY-MM-DD phải là ngày thực (không chấp nhận 2026-02-30). */
export const DateOnly = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, { message: "Ngày không hợp lệ (YYYY-MM-DD)." });

export const OffsetDateTime = z.string().datetime({ offset: true });

export const validateTaskSchedule = (value: TaskSchedule): string | null => {
  const { scheduledOn, scheduledStartAt, scheduledEndAt } = value;

  if (scheduledOn && (scheduledStartAt || scheduledEndAt)) {
    return "Chỉ chọn ngày làm hoặc khoảng giờ làm, không chọn đồng thời.";
  }

  if (Boolean(scheduledStartAt) !== Boolean(scheduledEndAt)) {
    return "Lịch làm cần có cả giờ bắt đầu và giờ kết thúc.";
  }

  if (
    scheduledStartAt && scheduledEndAt &&
    new Date(scheduledEndAt).getTime() <= new Date(scheduledStartAt).getTime()
  ) {
    return "Giờ kết thúc phải sau giờ bắt đầu.";
  }

  return null;
};

export const TaskScheduleSchema = z.object({
  scheduledOn: z.union([DateOnly, z.null()]),
  scheduledStartAt: z.union([OffsetDateTime, z.null()]),
  scheduledEndAt: z.union([OffsetDateTime, z.null()]),
}).superRefine((value, ctx) => {
  const message = validateTaskSchedule(value);
  if (message) ctx.addIssue({ code: "custom", message });
});

export const TaskDeadlineSchema = z.object({
  dueDate: z.union([OffsetDateTime, z.null()]),
  deadlineOn: z.union([DateOnly, z.null()]),
}).superRefine((value, ctx) => {
  if (value.dueDate && value.deadlineOn) {
    ctx.addIssue({
      code: "custom",
      message: "Hạn nộp chỉ có ngày hoặc có giờ, không đồng thời.",
    });
  }
});

/** Các trường lịch/hạn mới ở dạng patch (optional = không đổi), dùng chung cho create/update card. */
export const TaskDatesPatchShape = {
  deadlineOn: z.optional(z.union([DateOnly, z.null()])),
  scheduledOn: z.optional(z.union([DateOnly, z.null()])),
  scheduledStartAt: z.optional(z.union([OffsetDateTime, z.null()])),
  scheduledEndAt: z.optional(z.union([OffsetDateTime, z.null()])),
};
