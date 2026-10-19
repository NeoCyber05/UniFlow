"use server";

import { auth } from "@/server/auth";

import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import { createItemWithVersion } from "@/lib/checklists/checklist-mutations";
import { triggerChecklistItemCreated } from "@/lib/boards/realtime";

import { CreateChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, checklistId, title } = data;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: {
          board: {
            id: boardId,
            userId,
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const checklist = await db.checklist.findUnique({
      where: {
        id: checklistId,
        cardId,
      },
    });

    if (!checklist) {
      return { error: "Không tìm thấy danh sách việc cần làm." };
    }

    const { item: checklistItem, orderVersion } = await db.$transaction((tx) =>
      createItemWithVersion(tx, { checklistId, title }),
    );

    await triggerChecklistItemCreated({
      boardId,
      cardId: card.id,
      checklistId: checklist.id,
      checklistItemId: checklistItem.id,
      actorUserId: userId,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: { ...checklistItem, orderVersion } };
  } catch (error) {
    console.error("[CREATE_CHECKLIST_ITEM_ERROR]", error);
    return {
      error: "Tạo mục công việc thất bại.",
    };
  }
};

export const createChecklistItem = createSafeAction(CreateChecklistItem, handler);
