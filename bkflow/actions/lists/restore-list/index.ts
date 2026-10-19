"use server";

import { auth } from "@/server/auth";

import { revalidatePath } from "@/server/cache";

import { syncCardReminders } from "@/lib/notifications/reminder-deliveries";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerListCreated } from "@/lib/boards/realtime";
import {
  getRelatedDependencyCardIds,
  triggerRelatedDependencyCardsUpdated,
} from "@/lib/cards/realtime";

import { RestoreList } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, boardId } = data;
  let list;
  let affectedCardIds: string[] = [];
  let relatedDependencyCardIds: string[] = [];

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    list = await db.$transaction(async (tx) => {
      const existingList = await tx.list.findFirst({
        where: {
          id,
          boardId,
          archivedAt: {
            not: null,
          },
          board: {
            userId,
          },
        },
      });

      if (!existingList) {
        throw new Error("LIST_NOT_FOUND");
      }

      const restoredList = await tx.list.update({
        where: {
          id: existingList.id,
        },
        data: {
          archivedAt: null,
        },
      });

      const cardsToRestore = await tx.card.findMany({
        where: {
          listId: existingList.id,
          archivedByListId: existingList.id,
        },
        select: {
          id: true,
        },
      });
      affectedCardIds = cardsToRestore.map((card) => card.id);

      await tx.card.updateMany({
        where: {
          listId: existingList.id,
          archivedByListId: existingList.id,
        },
        data: {
          archivedAt: null,
          archivedByListId: null,
        },
      });

      await syncCardReminders(tx, { cardIds: affectedCardIds, now: new Date() });

      return restoredList;
    });
    relatedDependencyCardIds = await getRelatedDependencyCardIds({
      boardId,

      sourceCardIds: affectedCardIds,
    });

    await triggerListCreated({
      boardId,
      listId: list.id,
      actorUserId: userId,
    });

    await triggerRelatedDependencyCardsUpdated({
      boardId,
      sourceCardId: list.id,
      relatedCardIds: relatedDependencyCardIds,
      actorUserId: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LIST_NOT_FOUND") {
      return {
        error: "Không tìm thấy danh sách đã lưu trữ.",
      };
    }

    return {
      error: "Khôi phục danh sách thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const restoreList = createSafeAction(RestoreList, handler);
