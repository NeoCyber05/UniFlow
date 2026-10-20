import { zonedTimeToIso } from "@/lib/capture/analysis";
import { IMAGE_IMPORT_TIME_ZONE, type ImageTaskItem } from "@/lib/capture/image-import";

export const STUDY_PLAN_MAX_SESSIONS = 40;

// shortcut: chỉ bắt các cụm phổ biến có dấu; sót cách nói khác thì nâng lên cờ từ AI quick-analysis
const STUDY_PLAN_PATTERN = /ôn thi|lịch ôn|kế hoạch ôn|ôn tập/i;

/** Chữ gõ trong ô Thêm việc là yêu cầu lên kế hoạch ôn (không phải 1 việc). */
export const isStudyPlanRequest = (text: string) => STUDY_PLAN_PATTERN.test(text);

const at = (date: string, time: string) => Date.parse(zonedTimeToIso(date, time, IMAGE_IMPORT_TIME_ZONE) ?? "");

/** Giữ buổi ôn của môn có trong `exams`, nằm giữa `now` và giờ thi môn đó; bỏ phần AI trả sai. */
export const validateReviewItems = (items: ImageTaskItem[], exams: ImageTaskItem[], now: Date): ImageTaskItem[] =>
  items.flatMap((item) => {
    const code = item.courseCode?.trim().toUpperCase();
    const exam = exams.find((candidate) => candidate.courseCode?.toUpperCase() === code && candidate.date);
    if (!code || !exam || !item.date || !item.start || !item.end || item.end <= item.start) return [];
    const start = at(item.date, item.start);
    const end = at(item.date, item.end);
    const examAt = at(exam.date!, exam.start ?? "00:00");
    if (!Number.isFinite(start) || start < now.getTime() || end > examAt) return [];
    return [{ ...item, kind: "EVENT" as const, courseCode: code, role: "review" as const }];
  }).slice(0, STUDY_PLAN_MAX_SESSIONS);
