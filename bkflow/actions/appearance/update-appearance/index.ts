"use server";

import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { readPageStyle } from "@/lib/notes/page-style";

import { UpdateAppearance } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { accent, background, pageStyle } = data;

  try {
    const preference = await db.userPreference.upsert({
      where: { userId },
      create: { userId, accent, background, pageStyle },
      update: { accent, background, ...(pageStyle ? { pageStyle } : {}) },
    });
    return { data: { accent, background, pageStyle: readPageStyle(preference.pageStyle) } };
  } catch (error) {
    console.error("[UPDATE_APPEARANCE]", error);
    return {
      error: "Không thể lưu giao diện.",
    };
  }

};

export const updateAppearance = createSafeAction(UpdateAppearance, handler);
