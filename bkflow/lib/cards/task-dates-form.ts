import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { validateTaskSchedule } from "@/lib/cards/task-schedule";
import { getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";

/** Form hạn nộp + lịch làm, mọi giờ theo Asia/Ho_Chi_Minh (+07:00). */
export type TaskDatesForm = {
  deadlineDate: string;
  deadlineTime: string;
  scheduleStartDate: string;
  scheduleStartTime: string;
  scheduleEndDate: string;
  scheduleEndTime: string;
  reminder: string;
};

export type TaskDatesPatch = {
  dueDate: Date | null;
  deadlineOn: string | null;
  scheduledOn: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  reminder: string;
};

type StoredDates = {
  dueDate: unknown;
  deadlineOn: unknown;
  scheduledOn: unknown;
  scheduledStartAt: unknown;
  scheduledEndAt: unknown;
  reminder: string | null;
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
// Giá trị từ API là chuỗi dù type Prisma ghi Date; date-only chỉ lấy 10 ký tự đầu.
const asDate = (value: unknown) => (value ? new Date(value as string) : null);
const asDateOnly = (value: unknown) => (value ? (typeof value === "string" ? value : (value as Date).toISOString()).slice(0, 10) : "");
const vnTime = (date: Date) => new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(11, 16);
const vnInstant = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

export const taskDatesToForm = (data: StoredDates): TaskDatesForm => {
  const due = asDate(data.dueDate);
  const start = asDate(data.scheduledStartAt);
  const end = asDate(data.scheduledEndAt);
  const key = (date: Date) => getVNDayKey(getVNDay(date));

  return {
    deadlineDate: due ? key(due) : asDateOnly(data.deadlineOn),
    deadlineTime: due ? vnTime(due) : "",
    scheduleStartDate: start ? key(start) : asDateOnly(data.scheduledOn),
    scheduleStartTime: start ? vnTime(start) : "",
    scheduleEndDate: end ? key(end) : "",
    scheduleEndTime: end ? vnTime(end) : "",
    reminder: data.reminder || "none",
  };
};

export const buildTaskDatesPatch = (
  form: TaskDatesForm,
): { error: string } | { patch: TaskDatesPatch; warning: string | null } => {
  const { deadlineDate, deadlineTime, scheduleStartDate, scheduleStartTime, scheduleEndDate, scheduleEndTime } = form;

  if (deadlineTime && !deadlineDate) return { error: "Chọn ngày hạn nộp." };

  const patch: TaskDatesPatch = {
    dueDate: deadlineDate && deadlineTime ? vnInstant(deadlineDate, deadlineTime) : null,
    deadlineOn: deadlineDate && !deadlineTime ? deadlineDate : null,
    scheduledOn: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    reminder: deadlineDate ? form.reminder : "none",
  };

  if (!scheduleStartDate) {
    if (scheduleStartTime || scheduleEndDate || scheduleEndTime) return { error: "Chọn ngày bắt đầu lịch làm." };
  } else if (!scheduleStartTime && !scheduleEndTime) {
    if (scheduleEndDate && scheduleEndDate !== scheduleStartDate) return { error: "Lịch làm nhiều ngày cần giờ bắt đầu và kết thúc." };
    patch.scheduledOn = scheduleStartDate;
  } else {
    if (!scheduleStartTime || !scheduleEndTime) return { error: "Lịch làm theo giờ cần cả giờ bắt đầu và giờ kết thúc." };
    patch.scheduledStartAt = vnInstant(scheduleStartDate, scheduleStartTime).toISOString();
    patch.scheduledEndAt = vnInstant(scheduleEndDate || scheduleStartDate, scheduleEndTime).toISOString();
  }

  const scheduleError = validateTaskSchedule(patch);
  if (scheduleError) return { error: scheduleError };

  const deadlineAt = getTaskDeadlineAt({ dueDate: patch.dueDate, deadlineOn: patch.deadlineOn });
  const scheduleEnd = patch.scheduledEndAt
    ? new Date(patch.scheduledEndAt)
    : patch.scheduledOn ? vnInstant(patch.scheduledOn, "23:59") : null;
  const warning = deadlineAt && scheduleEnd && scheduleEnd.getTime() > deadlineAt.getTime()
    ? "Buổi làm nằm sau hạn nộp. Hạn nộp vẫn được giữ nguyên."
    : null;

  return { patch, warning };
};
