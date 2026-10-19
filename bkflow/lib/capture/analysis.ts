import { z } from "zod";

import { DateOnly, TaskDeadlineSchema, TaskScheduleSchema } from "@/lib/cards/task-schedule";
import type { CaptureFields } from "@/lib/capture/draft";

export const CAPTURE_TITLE_MAX_LENGTH = 200;
export const CAPTURE_CHECKLIST_MAX_ITEMS = 20;
export const CAPTURE_CHECKLIST_ITEM_MAX_LENGTH = 120;
const ISSUE_REASON_MAX_LENGTH = 200;

export const CAPTURE_FIELD_KEYS = [
  "title",
  "deadline",
  "schedule",
  "reminder",
  "isImportant",
  "courseId",
  "checklistItems",
] as const satisfies readonly (keyof CaptureFields)[];

export type CaptureIssue = { field: keyof CaptureFields; reason: string };

export type CaptureAnalysis = {
  draftId: string;
  textRevision: number;
  fields: Partial<CaptureFields>;
  issues: CaptureIssue[];
};

export type CaptureAnalysisContext = {
  draftId: string;
  textRevision: number;
  /** Mốc cho ngày tương đối (thời điểm gửi tin đã kiểm chứng, hoặc lúc capture). */
  referenceIso: string;
  timeZone: string;
  allowedCourseIds: string[];
  /** Mốc "đã qua"; mặc định referenceIso. */
  nowIso?: string;
};

export class CaptureAnalysisError extends Error {}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const offsetMs = (instant: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(instant / 1000) * 1000;
};

/** Giờ tường (YYYY-MM-DD + HH:mm) ở múi giờ IANA → ISO UTC; null khi giờ không tồn tại (DST). */
export const zonedTimeToIso = (date: string, time: string, timeZone: string): string | null => {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  let instant = wall - offsetMs(wall, timeZone);
  instant = wall - offsetMs(instant, timeZone);
  return instant + offsetMs(instant, timeZone) === wall ? new Date(instant).toISOString() : null;
};

export const getZonedDayKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));

const isDate = (value: unknown): value is string => DateOnly.safeParse(value).success;
const isTime = (value: unknown): value is string => typeof value === "string" && TIME.test(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanLine = (value: string) => value.replace(/\s+/g, " ").trim();

const looksLikeMachineText = (value: string) =>
  /^[[{]/.test(value) || value.includes("```") || /^(error|lỗi|undefined|null)\b/i.test(value);

const parseTitle = (value: unknown) => {
  if (typeof value !== "string") return { value: undefined };
  const title = cleanLine(value);
  if (!title) return { value: undefined };
  if (looksLikeMachineText(title)) return { issue: "AI trả tiêu đề không hợp lệ, hãy nhập tiêu đề." };
  return { value: title.slice(0, CAPTURE_TITLE_MAX_LENGTH) };
};

const parseDeadline = (value: unknown, timeZone: string) => {
  if (value === null || value === undefined) return { value: undefined };
  if (!isRecord(value) || !isDate(value.date)) return { issue: "AI trả hạn nộp không hợp lệ." };
  if (value.time === null || value.time === undefined || value.time === "") {
    return { value: { dueDate: null, deadlineOn: value.date } };
  }
  if (!isTime(value.time)) return { issue: "AI trả giờ hạn nộp không hợp lệ." };
  const dueDate = zonedTimeToIso(value.date, value.time, timeZone);
  if (!dueDate) return { issue: "Giờ hạn nộp không tồn tại ở múi giờ này." };
  return { value: { dueDate, deadlineOn: null } };
};

const parseSchedule = (value: unknown, timeZone: string) => {
  if (value === null || value === undefined) return { value: undefined };
  if (!isRecord(value) || !isDate(value.date)) return { issue: "AI trả lịch làm không hợp lệ." };
  const hasStart = value.startTime !== null && value.startTime !== undefined && value.startTime !== "";
  const hasEnd = value.endTime !== null && value.endTime !== undefined && value.endTime !== "";
  if (!hasStart && !hasEnd) {
    return { value: { scheduledOn: value.date, scheduledStartAt: null, scheduledEndAt: null } };
  }
  if (!hasStart || !hasEnd) return { issue: "Lịch làm cần cả giờ bắt đầu và giờ kết thúc." };
  if (!isTime(value.startTime) || !isTime(value.endTime)) return { issue: "AI trả giờ lịch làm không hợp lệ." };
  const scheduledStartAt = zonedTimeToIso(value.date, value.startTime, timeZone);
  const scheduledEndAt = zonedTimeToIso(value.date, value.endTime, timeZone);
  if (!scheduledStartAt || !scheduledEndAt) return { issue: "Giờ lịch làm không tồn tại ở múi giờ này." };
  const schedule = { scheduledOn: null, scheduledStartAt, scheduledEndAt };
  const parsed = TaskScheduleSchema.safeParse(schedule);
  if (!parsed.success) return { issue: parsed.error.issues[0]?.message ?? "Lịch làm không hợp lệ." };
  return { value: schedule };
};

const parseChecklist = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const title = cleanLine(item).slice(0, CAPTURE_CHECKLIST_ITEM_MAX_LENGTH);
    const key = title.toLowerCase();
    if (!title || seen.has(key) || looksLikeMachineText(title)) continue;
    seen.add(key);
    items.push(title);
    if (items.length >= CAPTURE_CHECKLIST_MAX_ITEMS) break;
  }
  return items;
};

const parseIssues = (value: unknown): CaptureIssue[] => {
  if (!Array.isArray(value)) return [];
  const keys = new Set<string>(CAPTURE_FIELD_KEYS);
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.field !== "string" || !keys.has(item.field)) return [];
    const reason = typeof item.reason === "string" ? cleanLine(item.reason).slice(0, ISSUE_REASON_MAX_LENGTH) : "";
    return [{ field: item.field as keyof CaptureFields, reason: reason || "Thông tin chưa rõ, hãy kiểm tra lại." }];
  });
};

const pastIssue = (fields: Partial<CaptureFields>, context: CaptureAnalysisContext): CaptureIssue[] => {
  const now = context.nowIso ?? context.referenceIso;
  const today = getZonedDayKey(now, context.timeZone);
  const issues: CaptureIssue[] = [];
  const deadline = fields.deadline;
  if (deadline && (deadline.dueDate ? deadline.dueDate < new Date(now).toISOString() : deadline.deadlineOn! < today)) {
    issues.push({ field: "deadline", reason: "Hạn nộp đã ở trong quá khứ, hãy kiểm tra lại ngày." });
  }
  const schedule = fields.schedule;
  if (schedule && (schedule.scheduledEndAt ? schedule.scheduledEndAt < new Date(now).toISOString() : schedule.scheduledOn! < today)) {
    issues.push({ field: "schedule", reason: "Lịch làm đã ở trong quá khứ, hãy kiểm tra lại ngày." });
  }
  return issues;
};

/**
 * Kiểm JSON của model cho quick capture. Giá trị có issue từ model bị bỏ (không bịa thời điểm);
 * cảnh báo "đã qua" do validator thêm vẫn giữ giá trị để người dùng xem và sửa. draftId/revision lấy
 * từ request, không từ model.
 */
export const validateCaptureAnalysis = (raw: unknown, context: CaptureAnalysisContext): CaptureAnalysis => {
  if (!isRecord(raw)) throw new CaptureAnalysisError("AI chưa trả kết quả hợp lệ.");

  const issues = parseIssues(raw.issues);
  const flagged = new Set(issues.map((issue) => issue.field));
  const fields: Partial<CaptureFields> = {};
  const addIssue = (field: keyof CaptureFields, reason: string) => {
    issues.push({ field, reason });
    flagged.add(field);
  };

  const title = parseTitle(raw.title);
  if (title.issue) addIssue("title", title.issue);
  else if (title.value && !flagged.has("title")) fields.title = title.value;

  const deadline = parseDeadline(raw.deadline, context.timeZone);
  if (deadline.issue) addIssue("deadline", deadline.issue);
  else if (deadline.value && !flagged.has("deadline") && TaskDeadlineSchema.safeParse(deadline.value).success) {
    fields.deadline = deadline.value;
  }

  const schedule = parseSchedule(raw.schedule, context.timeZone);
  if (schedule.issue) addIssue("schedule", schedule.issue);
  else if (schedule.value && !flagged.has("schedule")) fields.schedule = schedule.value;

  if (raw.isImportant === true && !flagged.has("isImportant")) fields.isImportant = true;

  if (typeof raw.courseId === "string" && raw.courseId) {
    if (context.allowedCourseIds.includes(raw.courseId)) {
      if (!flagged.has("courseId")) fields.courseId = raw.courseId;
    } else {
      addIssue("courseId", "AI gợi ý môn không thuộc học kỳ này, đã bỏ qua.");
    }
  }

  const checklistItems = parseChecklist(raw.checklistItems);
  if (checklistItems.length > 0 && !flagged.has("checklistItems")) fields.checklistItems = checklistItems;

  issues.push(...pastIssue(fields, context));

  return {
    draftId: context.draftId,
    textRevision: context.textRevision,
    fields,
    issues: z.array(z.object({ field: z.enum(CAPTURE_FIELD_KEYS), reason: z.string() })).parse(issues),
  };
};
