import { z } from "zod";

import { TaskDeadlineSchema, TaskScheduleSchema, type TaskDeadline, type TaskSchedule } from "@/lib/cards/task-schedule";

import type { CaptureFieldKey, CaptureFields } from "./draft";

export type CaptureIssue = { field: CaptureFieldKey; reason: string };

export type CaptureAnalysis = {
  draftId: string;
  textRevision: number;
  fields: Partial<CaptureFields>;
  issues: CaptureIssue[];
};

export type CaptureAnalysisContext = {
  draftId: string;
  textRevision: number;
  rawText: string;
  /** Anchor for "hôm nay"/"mai": verified message time, else capture time. */
  referenceIso: string;
  nowIso: string;
  timeZone: string;
  allowedCourseIds: string[];
  requiresRelativeDateConfirmation?: boolean;
};

const TITLE_MAX = 200;
const TODO_MAX = 20;
const TODO_ITEM_MAX = 120;
const ISSUE_MAX = 200;
const FIELD_KEYS: CaptureFieldKey[] = ["title", "deadline", "schedule", "reminder", "isImportant", "courseId", "checklistItems"];

// A clock time written in the text ("17h", "17h30", "5 giờ", "19:00"). Without one, any AI hour is invented.
const HAS_CLOCK_TIME = /\d{1,2}\s*(h|g|giờ|:\d{2})/i;

export const getLocalDayKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

const toIso = (value: string | null) => (value ? new Date(value).toISOString() : null);

const cleanLine = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

const normalizeTodos = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    const item = cleanLine(raw).slice(0, TODO_ITEM_MAX);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    items.push(item);
  }
  return items.slice(0, TODO_MAX);
};

const ModelIssue = z.object({
  field: z.enum(FIELD_KEYS as [CaptureFieldKey, ...CaptureFieldKey[]]),
  reason: z.string().transform((value) => cleanLine(value).slice(0, ISSUE_MAX)).pipe(z.string().min(1)),
});

/**
 * Turns untrusted model JSON into draft fields. Each field is checked on its own: a bad
 * field is dropped (with an issue when the user should look at it) instead of failing all.
 */
export const validateCaptureAnalysis = (raw: unknown, context: CaptureAnalysisContext): CaptureAnalysis => {
  const fields: Partial<CaptureFields> = {};
  const issues: CaptureIssue[] = [];
  const result = { draftId: context.draftId, textRevision: context.textRevision, fields, issues };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  const model = raw as Record<string, unknown>;

  const flag = (field: CaptureFieldKey, reason: string) => {
    if (!issues.some((issue) => issue.field === field)) issues.push({ field, reason });
  };
  const hasClockTime = HAS_CLOCK_TIME.test(context.rawText);
  const today = getLocalDayKey(context.nowIso, context.timeZone);
  const now = new Date(context.nowIso).getTime();

  if (Array.isArray(model.issues)) {
    for (const item of model.issues) {
      const parsed = ModelIssue.safeParse(item);
      if (parsed.success) flag(parsed.data.field, parsed.data.reason);
    }
  }

  const title = cleanLine(model.title);
  if (title && !/^[{[]/.test(title)) fields.title = title.slice(0, TITLE_MAX);

  if (model.deadline === null) fields.deadline = null;
  else if (model.deadline !== undefined) {
    const parsed = TaskDeadlineSchema.safeParse(model.deadline);
    if (!parsed.success) flag("deadline", "Hạn nộp AI đọc được không hợp lệ, hãy chọn lại.");
    else {
      let deadline: TaskDeadline = { dueDate: toIso(parsed.data.dueDate), deadlineOn: parsed.data.deadlineOn };
      if (deadline.dueDate && !hasClockTime) {
        deadline = { dueDate: null, deadlineOn: getLocalDayKey(deadline.dueDate, context.timeZone) };
        flag("deadline", "Câu không ghi giờ cụ thể; hạn được giữ theo ngày.");
      }
      const past = deadline.dueDate ? new Date(deadline.dueDate).getTime() < now : Boolean(deadline.deadlineOn && deadline.deadlineOn < today);
      if (past) flag("deadline", "Hạn nộp đã qua, hãy kiểm tra lại ngày.");
      fields.deadline = deadline.dueDate || deadline.deadlineOn ? deadline : null;
    }
  }

  if (model.schedule === null) fields.schedule = null;
  else if (model.schedule !== undefined) {
    const parsed = TaskScheduleSchema.safeParse(model.schedule);
    if (!parsed.success) flag("schedule", "Lịch làm AI đọc được không hợp lệ, hãy chọn lại.");
    else {
      let schedule: TaskSchedule = {
        scheduledOn: parsed.data.scheduledOn,
        scheduledStartAt: toIso(parsed.data.scheduledStartAt),
        scheduledEndAt: toIso(parsed.data.scheduledEndAt),
      };
      if (schedule.scheduledStartAt && !hasClockTime) {
        schedule = { scheduledOn: getLocalDayKey(schedule.scheduledStartAt, context.timeZone), scheduledStartAt: null, scheduledEndAt: null };
        flag("schedule", "Câu không ghi giờ cụ thể; lịch làm được giữ theo ngày.");
      }
      const past = schedule.scheduledStartAt
        ? new Date(schedule.scheduledStartAt).getTime() < now
        : Boolean(schedule.scheduledOn && schedule.scheduledOn < today);
      if (past) flag("schedule", "Lịch làm đã qua, hãy kiểm tra lại ngày.");
      fields.schedule = schedule.scheduledOn || schedule.scheduledStartAt ? schedule : null;
    }
  }

  if (context.requiresRelativeDateConfirmation) {
    if (fields.deadline) flag("deadline", "Không rõ ngày gửi tin nhắn; hãy xác nhận ngày hạn.");
    if (fields.schedule) flag("schedule", "Không rõ ngày gửi tin nhắn; hãy xác nhận ngày làm.");
  }

  if (typeof model.isImportant === "boolean") fields.isImportant = model.isImportant;

  // An unknown course is just a bad suggestion: drop it, never pass a foreign id on.
  if (model.courseId === null) fields.courseId = null;
  else if (typeof model.courseId === "string" && context.allowedCourseIds.includes(model.courseId)) fields.courseId = model.courseId;

  const todos = normalizeTodos(model.checklistItems);
  if (todos) fields.checklistItems = todos;

  return result;
};
