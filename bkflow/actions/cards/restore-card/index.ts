"use server";

import { auth } from "@/server/auth";

import { revalidatePath } from "@/server/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { syncCardReminder } from "@/lib/notifications/reminder-deliveries";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";
import {
  getRelatedDependencyCardIds,
  triggerRelatedDependencyCardsUpdated,
} from "@/lib/cards/realtime";

import { RestoreCard } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, boardId } = data;
  let card;
  let relatedDependencyCardIds: string[] = [];

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    card = await db.$transaction(async (tx) => {
      const existingCard = await tx.card.findFirst({
        where: {
          id,
          archivedAt: {
            not: null,
          },
          list: {
            board: {
              id: boardId,
              userId,
            },
          },
        },
        include: {
          list: {
            select: {
              archivedAt: true,
              title: true,
            },
          },
        },
      });

      if (!existingCard) {
        throw new Error("CARD_NOT_FOUND");
      }

      if (existingCard.list.archivedAt) {
        throw new Error("LIST_ARCHIVED");
      }

      const restored = await tx.card.update({
        where: {
          id: existingCard.id,
        },
        data: {
          archivedAt: null,
          archivedByListId: null,
        },
        include: {
          list: {
            select: {
              archivedAt: true,
              title: true,
            },
          },
        },
      });
      await syncCardReminder(tx, { cardId: restored.id, now: new Date() });

      return restored;
    });
    relatedDependencyCardIds = await getRelatedDependencyCardIds({
      boardId,

      sourceCardIds: [card.id],
    });

    await triggerCardCreated({
      boardId,
      listId: card.listId,
      cardId: card.id,
      actorUserId: userId,
    });

    await triggerRelatedDependencyCardsUpdated({
      boardId,
      sourceCardId: card.id,
      relatedCardIds: relatedDependencyCardIds,
      actorUserId: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") {
      return {
        error: "Không tìm thấy thẻ đã lưu trữ.",
      };
    }

    if (error instanceof Error && error.message === "LIST_ARCHIVED") {
      return {
        error: "Cần khôi phục danh sách trước khi khôi phục thẻ này.",
      };
    }

    return {
      error: "Khôi phục thẻ thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const restoreCard = createSafeAction(RestoreCard, handler);
