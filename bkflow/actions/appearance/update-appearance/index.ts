"use server";

import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { readPageStyle } from "@/lib/notes/page-style";
import { DEFAULT_ACCENT, DEFAULT_BACKGROUND, isAccentId, isBackgroundId } from "@/constants/appearance";

import { UpdateAppearance } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId || (data.expectedUserId && data.expectedUserId !== userId)) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { accent, background, pageStyle } = data;

  try {
    const preference = await db.userPreference.upsert({
      where: { userId },
      create: { userId, accent: accent ?? DEFAULT_ACCENT, background: background ?? DEFAULT_BACKGROUND, pageStyle },
      update: { ...(accent !== undefined && { accent }), ...(background !== undefined && { background }), ...(pageStyle !== undefined && { pageStyle }) },
    });
    return { data: { accent: isAccentId(preference.accent) ? preference.accent : DEFAULT_ACCENT, background: isBackgroundId(preference.background) ? preference.background : DEFAULT_BACKGROUND, pageStyle: readPageStyle(preference.pageStyle) } };
  } catch (error) {
    console.error("[UPDATE_APPEARANCE]", error);
    return {
      error: "Không thể lưu giao diện.",
    };
  }

};

export const updateAppearance = createSafeAction(UpdateAppearance, handler);
