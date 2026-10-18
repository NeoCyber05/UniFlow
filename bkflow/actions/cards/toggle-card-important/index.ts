"use server";

import { auth } from "@/server/clerk";

import { createSafeAction } from "@/lib/create-safe-action";
import { setCardUserState } from "@/lib/cards/card-user-state";

import { ToggleCardImportant } from "./schema";
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
      patch: { isImportant: data.value },
    });
  } catch {
    return { error: "Cập nhật thất bại." };
  }
};

export const toggleCardImportant = createSafeAction(ToggleCardImportant, handler);
