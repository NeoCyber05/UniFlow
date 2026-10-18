"use server";

import { auth } from "@/server/auth";

import { updateCardService } from "@/lib/cards/card-update-service";
import { createSafeAction } from "@/lib/create-safe-action";

import { UpdateCard } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  return updateCardService({ data, userId });
};

export const updateCard = createSafeAction(UpdateCard, handler);
