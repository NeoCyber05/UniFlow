"use server";

import { auth } from "@/server/auth";
import { createSafeAction, type ActionState } from "@/lib/create-safe-action";
import { ApplyAiSchedule, type ApplyAiScheduleInput } from "@/lib/calendar/ai-schedule";
import { AiScheduleError, applySchedulePreview } from "@/lib/calendar/ai-schedule-server";
import { logger } from "@/lib/logger";

const handler = async (input: ApplyAiScheduleInput): Promise<ActionState<ApplyAiScheduleInput, { count: number }>> => {
  const { userId } = await auth();
  if (!userId) return { error: "Không có quyền truy cập." };
  try {
    return { data: await applySchedulePreview(input, userId) };
  } catch (error) {
    logger.error("[AI_SCHEDULE_APPLY_ERROR]", error);
    return { error: error instanceof AiScheduleError
      ? error.message : "Không lưu được lịch hoặc lịch vừa thay đổi. Hãy tải lại và tạo đề xuất mới." };
  }
};

export const applyAiSchedule = createSafeAction(ApplyAiSchedule, handler);
