"use server";

import { z } from "zod";

import { auth } from "@/server/auth";

import { CAPTURE_IMAGE_SYSTEM_PROMPT } from "@/lib/ai/capture-image-prompt";
import { generateAiTextFromImage } from "@/lib/ai/client";
import { parseAiJson } from "@/lib/ai/json";
import { getZonedDayKey } from "@/lib/capture/analysis";
import {
  IMAGE_IMPORT_TIME_ZONE,
  ImageTaskItem,
  mondayOf,
  TimetableSession,
  WEEKDAY_LABELS,
  type ImageAnalysis,
} from "@/lib/capture/image-import";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireBoardEditor } from "@/lib/permissions";

import { AnalyzeCaptureImage } from "./schema";
import { InputType, ReturnType } from "./types";

const RawAnalysis = z.object({
  type: z.enum(["timetable", "tasks"]),
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

    const board = await db.board.findUnique({
      where: { id: boardId },
      select: { semester: { select: { startDate: true } } },
    });
    const now = new Date().toISOString();
    const [header, base64] = image.split(",", 2);
    const mediaType = header.slice("data:".length, header.indexOf(";"));

    const raw = await generateAiTextFromImage({
      system: CAPTURE_IMAGE_SYSTEM_PROMPT,
      user: JSON.stringify({
        today: getZonedDayKey(now, IMAGE_IMPORT_TIME_ZONE),
        timeZone: IMAGE_IMPORT_TIME_ZONE,
        ...(prompt?.trim() ? { instruction: prompt.trim() } : {}),
      }),
      image: { data: base64, mediaType },
    });
    const parsed = parseAiJson(raw, RawAnalysis, "AI chưa đọc được ảnh. Hãy thử ảnh rõ hơn.");
    const analysis: ImageAnalysis = parsed.type === "timetable"
      ? { type: "timetable", sessions: keepValid(TimetableSession, parsed.sessions?.map(withWeekday), 60) }
      : { type: "tasks", items: keepValid(ImageTaskItem, parsed.items, 30) };

    const startDate = board?.semester?.startDate;

    return {
      data: {
        analysis,
        week1Start: startDate ? mondayOf(getZonedDayKey(startDate.toISOString(), IMAGE_IMPORT_TIME_ZONE)) : null,
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
