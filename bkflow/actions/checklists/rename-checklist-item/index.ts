"use server";

import { auth } from "@/server/auth";

import { revalidatePath } from "@/server/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getChecklistItemAccess } from "@/lib/checklists/checklist-access";
import { triggerChecklistItemUpdated } from "@/lib/boards/realtime";

import { RenameChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, id, title } = data;

  try {
    const access = await getChecklistItemAccess({
      boardId,
      cardId,
      itemId: id,

      userId,
    });

    if (access.error || !access.item) {
      return { error: access.error || "Không tìm thấy mục công việc." };
    }

    if (access.item.title === title) {
      return { data: access.item };
    }

    const item = await db.checklistItem.update({
      where: {
        id,
      },
      data: {
        title,
      },
    });

    await triggerChecklistItemUpdated({
      boardId: access.item.checklist.card.list.boardId,
      cardId: access.item.checklist.cardId,
      checklistId: access.item.checklistId,
      checklistItemId: item.id,
      actorUserId: userId,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: item };
  } catch (error) {
    console.error("[RENAME_CHECKLIST_ITEM_ERROR]", error);
    return { error: "Đổi tên mục công việc thất bại." };
  }
};

export const renameChecklistItem = createSafeAction(RenameChecklistItem, handler);
