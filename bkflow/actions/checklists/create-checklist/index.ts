"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerChecklistCreated } from "@/lib/boards/realtime";

import { CreateChecklist } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, title, copyFromChecklistId } = data;

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

    const lastChecklist = await db.checklist.findFirst({
      where: {
        cardId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    });

    const checklist = await db.checklist.create({
      data: {
        cardId,
        title,
        order: lastChecklist ? lastChecklist.order + 1 : 0,
      },
    });

    if (copyFromChecklistId) {
      const sourceItems = await db.checklistItem.findMany({
        where: {
          checklistId: copyFromChecklistId,
          checklist: {
            card: {
              list: {
                board: {
                  id: boardId,
                  userId,
                },
              },
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      });

      if (sourceItems.length > 0) {
        await db.checklistItem.createMany({
          data: sourceItems.map((item, index) => ({
            checklistId: checklist.id,
            title: item.title,
            isCompleted: false,
            order: index,
          })),
        });
      }
    }

    await triggerChecklistCreated({
      boardId,
      cardId: card.id,
      checklistId: checklist.id,
      actorUserId: userId,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: checklist };
  } catch (error) {
    console.error("[CREATE_CHECKLIST_ERROR]", error);
    return {
      error: "Tạo danh sách việc cần làm thất bại.",
    };
  }
};

export const createChecklist = createSafeAction(CreateChecklist, handler);
