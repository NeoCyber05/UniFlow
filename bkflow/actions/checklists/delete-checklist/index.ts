"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";
import { NOTIFICATION_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerChecklistDeleted } from "@/lib/boards/realtime";

import { DeleteChecklist } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, id } = data;

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
        id,
        cardId,
      },
    });

    if (!checklist) {
      return { error: "Không tìm thấy danh sách việc cần làm." };
    }

    const checklistItems = await db.checklistItem.findMany({
      where: {
        checklistId: checklist.id,
      },
      select: {
        id: true,
      },
    });

    if (checklistItems.length > 0) {
      await db.notification.deleteMany({
        where: {
          type: NOTIFICATION_TYPE.CHECKLIST_ITEM_ASSIGNED,
          dedupeKey: {
            in: checklistItems.map((item) => `checklist-item-assigned:${item.id}`),
          },
          readAt: null,
        },
      });
    }

    await db.checklist.delete({
      where: {
        id,
      },
    });

    await triggerChecklistDeleted({
      boardId,
      cardId: card.id,
      checklistId: checklist.id,
      actorUserId: userId,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: checklist };
  } catch (error) {
    console.error("[DELETE_CHECKLIST_ERROR]", error);
    return {
      error: "Xóa danh sách việc cần làm thất bại.",
    };
  }
};

export const deleteChecklist = createSafeAction(DeleteChecklist, handler);
