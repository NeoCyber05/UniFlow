import { z } from "zod";
import { DateOnly, OffsetDateTime } from "@/lib/cards/task-schedule";
import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";

export const AI_SCHEDULE_TASK_LIMIT = 20;
const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ.");
export const SchedulePreferences = z.object({
  fromDay: DateOnly,
  toDay: DateOnly,
  dayStart: TimeOfDay,
  dayEnd: TimeOfDay,
}).refine(value => value.fromDay <= value.toDay && Date.parse(value.toDay) - Date.parse(value.fromDay) < 31 * 86_400_000, "Chọn khoảng từ 1 đến 31 ngày.")
  .refine(value => value.dayStart < value.dayEnd, "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.");

export const ScheduleSlot = z.object({ cardId: z.string().min(1), startsAt: OffsetDateTime, endsAt: OffsetDateTime });
export const GenerateAiSchedule = SchedulePreferences.extend({
  boardId: z.string().min(1),
  cardIds: z.array(z.string().min(1)).min(1).max(AI_SCHEDULE_TASK_LIMIT).refine(ids => new Set(ids).size === ids.length),
  prompt: z.string().trim().max(1500),
});
export const ApplyAiSchedule = SchedulePreferences.extend({
  boardId: z.string().min(1),
  slots: z.array(ScheduleSlot.extend({ expectedUpdatedAt: OffsetDateTime })).min(1).max(AI_SCHEDULE_TASK_LIMIT),
});
export const AiScheduleResponse = z.object({
  summary: z.string().trim().min(1).max(600),
  slots: z.array(ScheduleSlot.extend({ reason: z.string().trim().max(240) })).max(AI_SCHEDULE_TASK_LIMIT),
});

export type SchedulePreferencesInput = z.infer<typeof SchedulePreferences>;
export type GenerateAiScheduleInput = z.infer<typeof GenerateAiSchedule>;
export type ApplyAiScheduleInput = z.infer<typeof ApplyAiSchedule>;
export type BusyInterval = { startsAt: string; endsAt: string };
export type ScheduleCandidate = { id: string; title: string; updatedAt: string; dueDate: string | null; deadlineOn: string | null };
export type AiSchedulePreview = {
  summary: string;
  slots: (z.infer<typeof AiScheduleResponse>["slots"][number] & { title: string; expectedUpdatedAt: string })[];
};

export const getScheduleBounds = (preferences: SchedulePreferencesInput) => ({
  from: new Date(`${preferences.fromDay}T00:00:00+07:00`),
  to: new Date(Date.parse(`${preferences.toDay}T00:00:00+07:00`) + 86_400_000),
});

export const validateScheduleSlots = ({ slots, candidates, busy, preferences, now }: {
  slots: z.infer<typeof ScheduleSlot>[];
  candidates: ScheduleCandidate[];
  busy: BusyInterval[];
  preferences: SchedulePreferencesInput;
  now: Date;
}): string | null => {
  const seen = new Set<string>();
  const occupied = busy.map(interval => ({ start: Date.parse(interval.startsAt), end: Date.parse(interval.endsAt) }));
  for (const slot of slots) {
    const candidate = candidates.find(card => card.id === slot.cardId);
    if (!candidate) return "Lịch chứa thẻ không còn hợp lệ. Hãy tạo lại đề xuất.";
    if (seen.has(slot.cardId)) return "Đề xuất có thẻ bị lặp. Hãy tạo lại đề xuất.";
    seen.add(slot.cardId);
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    const day = getVNDayKey(getVNDay(new Date(start)));
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < now.getTime() || end <= start ||
      day < preferences.fromDay || day > preferences.toDay ||
      start < Date.parse(`${day}T${preferences.dayStart}:00+07:00`) ||
      end > Date.parse(`${day}T${preferences.dayEnd}:00+07:00`)) {
      return "Giờ đề xuất nằm ngoài khoảng rảnh hoặc đã qua. Hãy tạo lại đề xuất.";
    }
    const deadline = getTaskDeadlineAt(candidate)?.getTime();
    if (deadline !== undefined && deadline > now.getTime() && end > deadline) return "Giờ làm vượt quá hạn nộp. Hãy tạo lại đề xuất.";
    if (occupied.some(interval => start < interval.end && end > interval.start)) return "Giờ làm bị trùng với lịch khác. Hãy tạo lại đề xuất.";
    occupied.push({ start, end });
  }
  return null;
};
