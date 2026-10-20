"use server";

import { z } from "zod";

import { auth } from "@/server/auth";

import { CAPTURE_IMAGE_SYSTEM_PROMPT } from "@/lib/ai/capture-image-prompt";
import { generateAiText, generateAiTextFromImage } from "@/lib/ai/client";
import { parseAiJson } from "@/lib/ai/json";
import { getZonedDayKey } from "@/lib/capture/analysis";
import {
  IMAGE_IMPORT_TIME_ZONE,
  ImageTaskItem,
  TimetableSession,
  WEEKDAY_LABELS,
  type ImageAnalysis,
} from "@/lib/capture/image-import";
import { createSafeAction } from "@/lib/create-safe-action";
import { logger } from "@/lib/logger";
import { requireBoardEditor } from "@/lib/permissions";
import { generateStudyPlan } from "@/lib/study-plan/generate";

import { AnalyzeCaptureImage } from "./schema";
import { InputType, ReturnType } from "./types";

const RawAnalysis = z.object({
  type: z.enum(["timetable", "tasks"]),
  wantsStudyPlan: z.boolean().optional(),
  sessions: z.array(z.unknown()).optional(),
  items: z.array(z.unknown()).optional(),
});

/** Bỏ từng phần tử AI trả sai thay vì hỏng cả ảnh. */
const keepValid = <T>(schema: z.ZodType<T>, values: unknown[] | undefined, max: number) =>
  (values ?? []).flatMap((value) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  }).slice(0, max);

/** AI chép nhãn thứ ("T2", "CN") → weekday 1..7; tự quy đổi số dễ lệch một ngày. */
const withWeekday = (value: unknown) => {
  if (!value || typeof value !== "object" || !("day" in value) || typeof value.day !== "string") return value;
  const label = value.day.trim().toUpperCase().replace(/^THỨ\s*/, "T").replace(/^CHỦ NHẬT$/, "CN");
  return { ...value, weekday: (WEEKDAY_LABELS as readonly string[]).indexOf(label) };
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, image, prompt } = data;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const now = new Date();
    const today = getZonedDayKey(now.toISOString(), IMAGE_IMPORT_TIME_ZONE);
    const instruction = prompt?.trim() ?? "";
    const user = JSON.stringify({ today, timeZone: IMAGE_IMPORT_TIME_ZONE, ...(instruction ? { instruction } : {}) });
    let raw: string;
    if (image) {
      const [header, base64] = image.split(",", 2);
      const mediaType = header.slice("data:".length, header.indexOf(";"));
      raw = await generateAiTextFromImage({ system: CAPTURE_IMAGE_SYSTEM_PROMPT, user, image: { data: base64, mediaType } });
    } else {
      raw = await generateAiText({ system: CAPTURE_IMAGE_SYSTEM_PROMPT, user, temperature: 0.1, maxTokens: 4_000 });
    }
    const parsed = parseAiJson(raw, RawAnalysis, "AI chưa đọc được lịch. Hãy thử ảnh rõ hơn hoặc ghi rõ ngày giờ.");
    let analysis: ImageAnalysis = parsed.type === "timetable"
      ? { type: "timetable", sessions: keepValid(TimetableSession, parsed.sessions?.map(withWeekday), 60) }
      : { type: "tasks", items: keepValid(ImageTaskItem, parsed.items, 30) };

    if (analysis.type === "tasks" && parsed.wantsStudyPlan) {
      const items = analysis.items.map((item) =>
        item.kind === "EVENT" && item.courseCode && item.date ? { ...item, role: "exam" as const } : item);
      const exams = items.filter((item) => item.role === "exam");
      try {
        const reviews = await generateStudyPlan({ exams, instruction, today, now });
        analysis = { type: "tasks", items: [...items, ...reviews], ...(reviews.length ? {} : { notice: "Chưa tạo được lịch ôn. Hãy ghi rõ mã môn và ngày thi." }) };
      } catch (error) {
        logger.warn("[STUDY_PLAN_ERROR]", { userId, boardId, errorMessage: error instanceof Error ? error.message : String(error) });
        analysis = { type: "tasks", items, notice: "Chưa tạo được lịch ôn. Hãy thử lại." };
      }
    }

    return {
      data: {
        analysis,
        // Workspace không có ngày; người dùng chọn tuần 1 trong dialog
        week1Start: null,
      },
    };
  } catch (error) {
    logger.warn("[ANALYZE_CAPTURE_IMAGE_ERROR]", {
      action: "analyze-capture-image",
      userId,
      boardId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { error: error instanceof Error && /^(AI|Chưa cấu hình)/.test(error.message) ? error.message : "AI chưa đọc được ảnh. Vui lòng thử lại." };
  }
};

export const analyzeCaptureImage = createSafeAction(AnalyzeCaptureImage, handler);
