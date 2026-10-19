"use server";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { syncCardReminder } from "@/lib/notifications/reminder-deliveries";
import { deleteCardReminderNotifications } from "@/lib/notifications/reminder-notifications";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCardDeleted } from "@/lib/boards/realtime";
import {
  getRelatedDependencyCardIds,
  triggerRelatedDependencyCardsUpdated,
} from "@/lib/cards/realtime";

import { ArchiveCard } from "./schema";
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
          archivedAt: null,
          list: {
            archivedAt: null,
            board: {
              id: boardId,
              userId,
            },
          },
        },
        include: {
          list: {
            select: {
              title: true,
            },
          },
        },
      });

      if (!existingCard) {
        throw new Error("CARD_NOT_FOUND");
      }

      const archived = await tx.card.update({
        where: {
          id: existingCard.id,
        },
        data: {
          archivedAt: new Date(),
          archivedByListId: null,
        },
        include: {
          list: {
            select: {
              title: true,
            },
          },
        },
      });
      await syncCardReminder(tx, { cardId: archived.id, now: new Date() });

      return archived;
    });
    await deleteCardReminderNotifications(card.id);
    relatedDependencyCardIds = await getRelatedDependencyCardIds({
      boardId,

      sourceCardIds: [card.id],
    });

    await triggerCardDeleted({
      boardId,
      listId: card.listId,
      cardId: card.id,
      actorUserId: userId,
      archived: true,
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
        error: "Không tìm thấy thẻ hoặc thẻ đã được lưu trữ.",
      };
    }

    return {
      error: "Lưu trữ thẻ thất bại.",
    };
  }

  return { data: card };
};

export const archiveCard = createSafeAction(ArchiveCard, handler);
