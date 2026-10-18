
import type {
  BoardCalendarCardItem,
  BoardCalendarChecklistItem,
  BoardCalendarItem,
} from "@/types";

import {
  formatCalendarDateTime,
  formatCalendarDate,
  getDayKey,
  formatCalendarTime,
  parseCalendarDate,
} from "./date-utils";
import type { CalendarOccurrence } from "../_types";

export const parseDayViewItemDates = (item: BoardCalendarItem) => ({
  startDate: isCalendarCardItem(item) ? parseCalendarDate(item.startDate) : null,
  dueDate: parseCalendarDate(item.dueDate),
});

export const isCalendarCardItem = (
  item: BoardCalendarItem,
): item is BoardCalendarCardItem => item.type === "card";

export const isCalendarChecklistItem = (
  item: BoardCalendarItem,
): item is BoardCalendarChecklistItem => item.type === "checklist-item";

export const getCalendarItemStartDate = (item: BoardCalendarItem) =>
  isCalendarCardItem(item) ? item.startDate : null;

export const getCalendarItemDueDate = (item: BoardCalendarItem) => item.dueDate;

export const getCalendarItemAssigneeCount = (item: BoardCalendarItem) =>
  isCalendarCardItem(item)
    ? item.assignees.length
    : item.assignee
      ? 1
      : 0;

export const getCalendarItemCommentCount = (item: BoardCalendarItem) =>
  isCalendarCardItem(item) ? item.commentCount : 0;

export const getCalendarItemTitle = (item: BoardCalendarItem) => {
  const startDate = parseCalendarDate(getCalendarItemStartDate(item));
  const dueDate = parseCalendarDate(getCalendarItemDueDate(item));
  const parts = [
    item.title,
    `Danh sách: ${item.listTitle}`,
  ];

  if (item.type === "checklist-item") {
    parts.splice(1, 0, `Thẻ: ${item.cardTitle}`);
    parts.splice(2, 0, `Danh sách kiểm tra: ${item.checklistTitle}`);
  }

  if (startDate) {
    parts.push(`Bắt đầu: ${formatCalendarDateTime(startDate)}`);
  }

  if (dueDate) {
    parts.push(`Kết thúc: ${formatCalendarDateTime(dueDate)}`);
  }

  if (item.isCompleted) {
    parts.push("Trạng thái: Hoàn thành");
  }

  if (item.type === "checklist-item" && item.assignee) {
    parts.push(`Phụ trách: ${item.assignee.userName}`);
  }

  return parts.join("\n");
};

export const getOccurrenceTimeLabel = (occurrence: CalendarOccurrence) => {
  const card = occurrence.item;

  if (isCalendarCardItem(card) && card.displayKind) {
    if (card.displayKind === "work") {
      const start = parseCalendarDate(card.startDate);
      const end = parseCalendarDate(card.dueDate);

      return card.scheduledStartAt && start && end
        ? `${formatCalendarTime(start)}-${formatCalendarTime(end)}`
        : null;
    }
    if (card.displayKind === "deadline") {
      const due = parseCalendarDate(card.dueDate);

      return card.dueDate && card.deadlineOn === null && due ? formatCalendarTime(due) : null;
    }
  }

  // Ngày làm / hạn chỉ-ngày không có giờ: không in 00:00.
  if (
    isCalendarCardItem(card) &&
    !card.scheduledStartAt &&
    (card.scheduledOn || (card.deadlineOn && !card.dueDate))
  ) {
    return null;
  }

  const startDate = parseCalendarDate(getCalendarItemStartDate(occurrence.item));
  const dueDate = parseCalendarDate(getCalendarItemDueDate(occurrence.item));

  if (startDate && dueDate && getDayKey(startDate) === getDayKey(dueDate)) {
    const startTime = formatCalendarTime(startDate);
    const dueTime = formatCalendarTime(dueDate);

    return startTime === dueTime ? startTime : `${startTime}-${dueTime}`;
  }

  if (
    getCalendarItemStartDate(occurrence.item) &&
    !getCalendarItemDueDate(occurrence.item) &&
    startDate
  ) {
    return formatCalendarTime(startDate);
  }

  if (getCalendarItemDueDate(occurrence.item) && dueDate) {
    return formatCalendarTime(dueDate);
  }

  if (startDate) {
    return formatCalendarTime(startDate);
  }

  return null;
};

export const getOccurrenceLabel = (occurrence: CalendarOccurrence) => {
  if (occurrence.item.type === "checklist-item") {
    return null;
  }

  if (occurrence.item.displayKind === "deadline") return "Hạn nộp";
  if (occurrence.item.displayKind === "legacy-start") return "Bắt đầu";
  if (occurrence.item.displayKind === "work") {
    return occurrence.item.scheduledStartAt ? null : "Lịch làm";
  }

  if (occurrence.kind === "start") {
    return "Bắt đầu";
  }

  if (occurrence.kind === "due") {
    return "Kết thúc";
  }

  if (occurrence.kind === "range") {
    const start = parseCalendarDate(occurrence.item.startDate);
    const due = parseCalendarDate(occurrence.item.dueDate);

    if (start && due) {
      return `${formatCalendarDate(start).slice(0, 5)} - ${formatCalendarDate(due).slice(0, 5)}`;
    }

    return null;
  }

  // Handles occurrence.kind === "single"
  const start = parseCalendarDate(occurrence.item.startDate);
  const due = parseCalendarDate(occurrence.item.dueDate);

  if (start && !due) {
    return "Bắt đầu";
  }

  if (!start && due) {
    return "Kết thúc";
  }

  if (start && due) {
    return null;
  }

  return "Lịch";
};

export const isOverdue = (item: BoardCalendarItem) => {
  // Thẻ đã qua adapter: startDate/dueDate là lịch làm, hạn nộp nằm ở deadlineAt.
  const dueDate = isCalendarCardItem(item) && item.deadlineAt !== undefined
    ? item.deadlineAt
    : getCalendarItemDueDate(item);

  if (!dueDate || item.isCompleted) {
    return false;
  }

  return new Date(dueDate).getTime() < Date.now();
};

export const getOccurrenceTone = (
  occurrence: CalendarOccurrence,
  courseTone?: string | null,
) => {
  if (occurrence.item.isCompleted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
  }

  if (isOverdue(occurrence.item) && occurrence.kind !== "start") {
    return "border-red-200 bg-red-50 text-red-800 hover:bg-red-100";
  }

  if (occurrence.item.type === "checklist-item") {
    return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  }

  if (occurrence.item.displayKind === "deadline") {
    return "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100";
  }

  if (occurrence.kind === "start") {
    return "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100";
  }

  return courseTone ?? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100";
};
