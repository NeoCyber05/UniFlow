"use server";

import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { updateCardService } from "@/lib/cards/card-update-service";

import { SetCardCompleted } from "./schema";
import { InputType, ReturnType } from "./types";

/**
 * Tick xong từ smart list: thẻ có thể thuộc org khác org đang active,
 * nên lấy org theo bảng chứa thẻ rồi để updateCardService kiểm quyền.
 */
const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  try {
    const card = await db.card.findUnique({
      where: { id: data.cardId },
      select: { list: { select: { boardId: true } } },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const result = await updateCardService({
      data: { id: data.cardId, boardId: card.list.boardId, isCompleted: data.value },
      userId,
    });

    return { error: result.error, errorCode: result.errorCode, data: result.data };
  } catch {
    return { error: "Cập nhật thất bại." };
  }
};

export const setCardCompleted = createSafeAction(SetCardCompleted, handler);
