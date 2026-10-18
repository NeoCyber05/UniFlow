import type { Card, Prisma } from "@prisma/client";

import type { TaskDeadline, TaskSchedule } from "@/lib/cards/task-schedule";

// DATE columns are exchanged as UTC midnight so the value never shifts with the process timezone.
const dateOnlyToDate = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);
const dateOnlyToString = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);
const isoToDate = (value: string | null) => (value ? new Date(value) : null);

export const toTaskScheduleStorage = (
  value: TaskSchedule,
): Pick<Prisma.CardUncheckedCreateInput, "scheduledOn" | "scheduledStartAt" | "scheduledEndAt"> => ({
  scheduledOn: dateOnlyToDate(value.scheduledOn),
  scheduledStartAt: isoToDate(value.scheduledStartAt),
  scheduledEndAt: isoToDate(value.scheduledEndAt),
});

export const toTaskDeadlineStorage = (
  value: TaskDeadline,
): Pick<Prisma.CardUncheckedCreateInput, "dueDate" | "deadlineOn"> => ({
  dueDate: isoToDate(value.dueDate),
  deadlineOn: dateOnlyToDate(value.deadlineOn),
});

export const serializeTaskDates = (
  card: Pick<Card, "dueDate" | "deadlineOn" | "scheduledOn" | "scheduledStartAt" | "scheduledEndAt">,
): TaskSchedule & TaskDeadline => ({
  dueDate: card.dueDate?.toISOString() ?? null,
  deadlineOn: dateOnlyToString(card.deadlineOn),
  scheduledOn: dateOnlyToString(card.scheduledOn),
  scheduledStartAt: card.scheduledStartAt?.toISOString() ?? null,
  scheduledEndAt: card.scheduledEndAt?.toISOString() ?? null,
});
