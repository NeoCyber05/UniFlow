import type { Card, Prisma } from "@prisma/client";

import { getTaskReminderAt } from "@/lib/cards/task-deadline";
import type { UpdateCardInput } from "@/lib/cards/update-card-contract";
import type { CardUpdatedField } from "@/lib/realtime/types";

type CardDateInput = Pick<
  UpdateCardInput,
  | "title"
  | "description"
  | "startDate"
  | "dueDate"
  | "isCompleted"
  | "reminder"
>;

type EffectiveCardDatesInput = Pick<UpdateCardInput, "startDate" | "dueDate"> & {
  currentCard: Pick<Card, "startDate" | "dueDate">;
};

export const hasDateChanged = (
  nextDate: Date | null | undefined,
  currentDate: Date | null,
) => (
  nextDate !== undefined && (
    (nextDate === null && currentDate !== null) ||
    (nextDate !== null && currentDate === null) ||
    (nextDate !== null && currentDate !== null &&
      new Date(nextDate).getTime() !== new Date(currentDate).getTime())
  )
);

export const getEffectiveCardDates = ({
  startDate,
  dueDate,
  currentCard,
}: EffectiveCardDatesInput) => ({
  effectiveStartDate: startDate !== undefined
    ? startDate
    : currentCard.startDate,
  effectiveDueDate: dueDate !== undefined
    ? dueDate
    : currentCard.dueDate,
});

export const validateCardDateRange = (
  startDate: Date | null,
  dueDate: Date | null,
) => {
  if (
    startDate &&
    dueDate &&
    new Date(dueDate).getTime() - new Date(startDate).getTime() < 15 * 60_000
  ) {
    return "Khoảng thời gian tối thiểu là 15 phút.";
  }

  if (
    startDate &&
    dueDate &&
    new Date(startDate).getTime() > new Date(dueDate).getTime()
  ) {
    return "Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.";
  }

  return null;
};

export const validateReminderConfig = ({
  dueDate,
  deadlineOn = null,
  reminder,
}: {
  dueDate: Date | null;
  /** Hạn chỉ-ngày YYYY-MM-DD: nhắc tính từ 09:00 VN ngày hạn. */
  deadlineOn?: string | null;
  reminder: string | null;
}) => {
  if ((!dueDate && !deadlineOn) || !reminder || reminder === "none") {
    return null;
  }

  const offsetMinutes = parseInt(reminder, 10);

  if (Number.isNaN(offsetMinutes)) {
    return "Mốc nhắc nhở không hợp lệ.";
  }

  const triggerTime = getTaskReminderAt(
    { dueDate: dueDate?.toISOString() ?? null, deadlineOn },
    offsetMinutes,
  )!.getTime();

  if (triggerTime < Date.now()) {
    return "Thời gian nhắc nhở đã ở trong quá khứ. Hãy chọn mốc nhắc ngắn hơn hoặc đổi ngày hết hạn.";
  }

  return null;
};

export const getChangedCardFields = ({
  input,
  currentCard,
  startDateChanged,
  dueDateChanged,
  reminderChanged,
  reminderConfigChanged,
  deadlineCleared = false,
}: {
  input: CardDateInput;
  currentCard: Pick<Card, "title" | "description" | "isCompleted">;
  startDateChanged: boolean;
  dueDateChanged: boolean;
  reminderChanged: boolean;
  reminderConfigChanged: boolean;
  /** Hạn (cả dạng giờ lẫn chỉ-ngày) vừa bị xóa hẳn. */
  deadlineCleared?: boolean;
}) => {
  const changedFields: CardUpdatedField[] = [];

  if (input.title !== undefined && input.title !== currentCard.title) {
    changedFields.push("title");
  }

  if (
    input.description !== undefined &&
    input.description !== currentCard.description
  ) {
    changedFields.push("description");
  }

  if (startDateChanged) {
    changedFields.push("startDate");
  }

  if (dueDateChanged) {
    changedFields.push("dueDate");
  }

  if (
    input.isCompleted !== undefined &&
    input.isCompleted !== currentCard.isCompleted
  ) {
    changedFields.push("isCompleted");
  }

  if (reminderChanged) {
    changedFields.push("reminder");
  }

  if (reminderConfigChanged || deadlineCleared) {
    changedFields.push("reminderSetAt");
  }

  return changedFields;
};

export const buildCardUpdateData = ({
  input,
  reminderConfigChanged,
  descriptionChanged,
  deadlineCleared = false,
  extra = {},
}: {
  input: CardDateInput;
  reminderConfigChanged: boolean;
  descriptionChanged: boolean;
  deadlineCleared?: boolean;
  /** deadlineOn / scheduled* đã chuyển sang dạng lưu trữ (chỉ gồm trường được gửi). */
  extra?: Prisma.CardUpdateInput;
}): Prisma.CardUpdateInput => {
  const { startDate, dueDate, isCompleted, reminder, ...values } = input;

  return {
    ...values,
    ...(startDate !== undefined ? { startDate } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...extra,
    ...(isCompleted !== undefined ? { isCompleted } : {}),
    ...(reminder !== undefined ? { reminder } : {}),
    ...(descriptionChanged ? { descriptionUpdatedAt: new Date() } : {}),
    ...(reminderConfigChanged ? { reminderSetAt: new Date() } : {}),
    ...(deadlineCleared ? { reminderSetAt: null } : {}),
  };
};

export const shouldDeleteReminderNotifications = ({
  reminderConfigChanged,
  deadlineCleared = false,
  isCompleted,
}: {
  reminderConfigChanged: boolean;
  deadlineCleared?: boolean;
  isCompleted?: boolean;
}) => reminderConfigChanged || deadlineCleared || isCompleted === true;
