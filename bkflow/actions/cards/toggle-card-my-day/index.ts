"use server";

import { auth } from "@/server/clerk";

import { createSafeAction } from "@/lib/create-safe-action";
import { setCardUserState } from "@/lib/cards/card-user-state";

import { ToggleCardMyDay } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  try {
    return await setCardUserState({
      cardId: data.cardId,
      userId,
      patch: { myDayAt: data.value ? new Date() : null },
    });
  } catch {
    return { error: "Cập nhật thất bại." };
  }
};

export const toggleCardMyDay = createSafeAction(ToggleCardMyDay, handler);
