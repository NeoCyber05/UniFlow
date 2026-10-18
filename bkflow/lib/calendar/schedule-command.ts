import { DateOnly, type TaskSchedule } from "@/lib/cards/task-schedule";

export type ScheduleFormValues = { day: string; endDay: string; start: string; end: string };

export const getScheduleFormIntent = ({ day, endDay, start, end }: ScheduleFormValues): ScheduleIntent | { error: string } => {
  const validDay = (value: string) => DateOnly.safeParse(value).success;
  if (!validDay(day)) return { error: "Vui lòng chọn ngày hợp lệ." };
  if (!start && !end) return { type: "day", day };
  if (!validDay(endDay) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) {
    return { error: "Nhập đủ ngày và giờ bắt đầu, kết thúc hợp lệ." };
  }
  const startsAt = new Date(`${day}T${start}:00+07:00`).toISOString();
  const endsAt = new Date(`${endDay}T${end}:00+07:00`).toISOString();
  return Date.parse(endsAt) > Date.parse(startsAt)
    ? { type: "time", startsAt, endsAt }
    : { error: "Thời điểm kết thúc phải sau thời điểm bắt đầu." };
};

export type ScheduleIntent =
  | { type: "day"; day: string }
  /** Thả vào một giờ; chưa biết thời lượng thì cần `endsAt` (hỏi người dùng). */
  | { type: "time"; startsAt: string; endsAt?: string }
  /** Dời buổi đã có giờ, giữ thời lượng. */
  | { type: "move"; startsAt: string }
  | { type: "resize"; edge: "start" | "end"; at: string }
  | { type: "clear" };

export type NeedsEnd = { needsEnd: true; startsAt: string };

const range = (startsAt: string, endsAt: string): TaskSchedule => ({
  scheduledOn: null,
  scheduledStartAt: startsAt,
  scheduledEndAt: endsAt,
});

/**
 * Chỉ trả các trường lịch làm (không bao giờ chạm hạn/nhắc). `null` = thao tác bị từ chối.
 * Không áp thời lượng mặc định; độ snap 15 phút là việc của UI, không phải của backend.
 */
export const buildSchedulePatch = (current: TaskSchedule, intent: ScheduleIntent): TaskSchedule | NeedsEnd | null => {
  const currentRange = current.scheduledStartAt && current.scheduledEndAt
    ? { start: Date.parse(current.scheduledStartAt), end: Date.parse(current.scheduledEndAt) }
    : null;

  switch (intent.type) {
    case "clear":
      return { scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null };
    case "day":
      return { scheduledOn: intent.day, scheduledStartAt: null, scheduledEndAt: null };
    case "time": {
      if (!intent.endsAt) return { needsEnd: true, startsAt: intent.startsAt };

      return Date.parse(intent.endsAt) > Date.parse(intent.startsAt) ? range(intent.startsAt, intent.endsAt) : null;
    }
    case "move": {
      if (!currentRange) return { needsEnd: true, startsAt: intent.startsAt };
      const endsAt = new Date(Date.parse(intent.startsAt) + (currentRange.end - currentRange.start)).toISOString();

      return range(intent.startsAt, endsAt);
    }
    case "resize": {
      if (!currentRange) return null;
      const at = Date.parse(intent.at);
      const start = intent.edge === "start" ? at : currentRange.start;
      const end = intent.edge === "end" ? at : currentRange.end;

      return end > start ? range(new Date(start).toISOString(), new Date(end).toISOString()) : null;
    }
  }
};
