"use server";

import { auth } from "@/server/auth";
import { createSafeAction, type ActionState } from "@/lib/create-safe-action";
import { GenerateAiSchedule, type GenerateAiScheduleInput, type AiSchedulePreview } from "@/lib/calendar/ai-schedule";
import { AiScheduleError, generateSchedulePreview } from "@/lib/calendar/ai-schedule-server";
import { logger } from "@/lib/logger";

const handler = async (input: GenerateAiScheduleInput): Promise<ActionState<GenerateAiScheduleInput, AiSchedulePreview>> => {
  const { userId } = await auth();
  if (!userId) return { error: "Không có quyền truy cập." };
  try {
    return { data: await generateSchedulePreview(input, userId) };
  } catch (error) {
    logger.error("[AI_SCHEDULE_GENERATE_ERROR]", error);
    return { error: error instanceof AiScheduleError ? error.message : "Không tạo được lịch. Hãy thử lại." };
  }
};

export const generateAiSchedule = createSafeAction(GenerateAiSchedule, handler);
