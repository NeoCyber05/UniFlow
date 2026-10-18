import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { getStartOfVNDay, getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";
import type { BoardCalendarItem } from "@/types";

type ScheduleFields = {
  scheduledOn: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
};

const dayStartIso = (dateOnly: string) => {
  const [year, month, day] = dateOnly.split("-").map(Number);

  return getStartOfVNDay({ year, month: month - 1, day }).toISOString();
};

/**
 * Lịch làm -> (start, end) mà layout lịch đang dùng. Ngày-only = mốc 00:00 VN (nhãn giờ bị ẩn).
 * Không có lịch làm thì giữ mốc cũ: hạn nộp là marker, startDate là mốc bắt đầu cũ.
 */
export const toCalendarDisplayItem = (item: BoardCalendarItem): BoardCalendarItem => {
  if (item.type !== "card") return item;

  const deadlineAt = getTaskDeadlineAt(item)?.toISOString() ?? null;
  let startDate: string | null;
  let dueDate: string | null;

  if (item.scheduledStartAt && item.scheduledEndAt) {
    startDate = item.scheduledStartAt;
    dueDate = item.scheduledEndAt;
  } else if (item.scheduledOn) {
    startDate = null;
    dueDate = dayStartIso(item.scheduledOn);
  } else {
    startDate = item.startDate;
    dueDate = deadlineAt;
  }

  return { ...item, startDate, dueDate, deadlineAt };
};

/**
 * Một card -> các hiển thị riêng: buổi làm, hạn nộp (marker), mốc bắt đầu cũ (marker).
 * Không dựng khoảng start -> hạn. Id có hậu tố cho hạn/mốc cũ; cardId giữ nguyên cho mutation.
 */
export const toCalendarDisplayItems = (item: BoardCalendarItem): BoardCalendarItem[] => {
  if (item.type !== "card") return [item];

  const deadlineAt = getTaskDeadlineAt(item)?.toISOString() ?? null;
  const out: BoardCalendarItem[] = [];

  if (item.scheduledStartAt && item.scheduledEndAt) {
    out.push({ ...item, startDate: item.scheduledStartAt, dueDate: item.scheduledEndAt, deadlineAt, displayKind: "work" });
  } else if (item.scheduledOn) {
    out.push({ ...item, startDate: null, dueDate: dayStartIso(item.scheduledOn), deadlineAt, displayKind: "work" });
  }
  if (deadlineAt) {
    out.push({ ...item, id: `${item.id}:deadline`, startDate: null, dueDate: deadlineAt, deadlineAt, displayKind: "deadline" });
  }
  if (item.startDate && !out.some((i) => i.type === "card" && i.displayKind === "work")) {
    out.push({ ...item, id: `${item.id}:legacy-start`, startDate: item.startDate, dueDate: null, deadlineAt, displayKind: "legacy-start" });
  }

  return out;
};

/** Điểm thả trên lịch (start/end hiển thị) -> chỉ các trường lịch làm; không bao giờ chạm hạn nộp. */
export const toScheduleFields = (start: Date | null, end: Date | null): ScheduleFields => {
  if (start && end && end.getTime() > start.getTime()) {
    return { scheduledOn: null, scheduledStartAt: start.toISOString(), scheduledEndAt: end.toISOString() };
  }

  const day = start ?? end;

  return {
    scheduledOn: day ? getVNDayKey(getVNDay(day)) : null,
    scheduledStartAt: null,
    scheduledEndAt: null,
  };
};

/** Cập nhật lạc quan cache thô: giữ nguyên deadline, chỉ thay lịch làm. */
export const patchScheduleFields = <T extends ScheduleFields>(item: T, next: ScheduleFields): T => ({ ...item, ...next });
