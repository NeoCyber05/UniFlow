"use server";

import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import {
  triggerCardMoved,
  triggerCardReordered,
} from "@/lib/boards/realtime";

import { UpdateCardOrder } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { items, boardId, } = data;
  let updatedCards;
  let changedCards:
    | {
        id: string;
        order: number;
        listId: string;
      }[]
    = [];
  let movedCard:
    | {
        id: string;
        title: string;
        sourceListId: string;
        destinationListId: string;
      }
    | null = null;
  let reorderedListId: string | undefined;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const destinationListIds = Array.from(new Set(items.map((card) => card.listId)));
    const destinationListCount = await db.list.count({
      where: {
        id: {
          in: destinationListIds,
        },
        boardId,
        archivedAt: null,
        board: {
          userId,
        },
      },
    });

    if (destinationListCount !== destinationListIds.length) {
      return { error: "Không thể di chuyển thẻ sang bảng khác." };
    }

    const existingCards = await db.card.findMany({
      where: {
        id: {
          in: items.map((card) => card.id),
        },
        archivedAt: null,
        list: {
          archivedAt: null,
          board: {
            id: boardId,
            userId,
          },
        },
      },
    });

    if (existingCards.length !== items.length) {
      return { error: "Không thể sắp xếp thẻ không thuộc bảng này." };
    }

    const nextCardsById = new Map(items.map((card) => [card.id, card]));
    changedCards = existingCards.flatMap((card) => {
      const nextCard = nextCardsById.get(card.id);

      if (!nextCard || (nextCard.order === card.order && nextCard.listId === card.listId)) {
        return [];
      }

      return [{
        id: nextCard.id,
        order: nextCard.order,
        listId: nextCard.listId,
      }];
    });

    if (changedCards.length === 0) {
      return { data: existingCards };
    }

    const movedExistingCard = existingCards.find((card) => {
      const nextCard = nextCardsById.get(card.id);

      return Boolean(nextCard && nextCard.listId !== card.listId);
    });

    if (movedExistingCard) {
      const nextCard = nextCardsById.get(movedExistingCard.id);

      movedCard = nextCard
        ? {
            id: movedExistingCard.id,
            title: movedExistingCard.title,
            sourceListId: movedExistingCard.listId,
            destinationListId: nextCard.listId,
          }
        : null;
    } else {
      const listIds = Array.from(new Set(items.map((card) => card.listId)));
      reorderedListId = listIds.length === 1 ? listIds[0] : undefined;
    }

    const transaction = changedCards.map((card) => 
      db.card.update({
        where: {
          id: card.id,
          archivedAt: null,
          list: {
            archivedAt: null,
            board: {
              id: boardId,
              userId,
            },
          },
        },
        data: {
          order: card.order,
          listId: card.listId,
        },
      }),
    );

    updatedCards = await db.$transaction(transaction);
  } catch {
    return {
      error: "Thay đổi thứ tự thẻ thất bại."
    }
  }

  if (movedCard) {
    await triggerCardMoved({
      boardId,
      actorUserId: userId,
      cardId: movedCard.id,
      sourceListId: movedCard.sourceListId,
      destinationListId: movedCard.destinationListId,
      sourceOrderedCardIds: items
        .filter((card) => card.listId === movedCard!.sourceListId)
        .sort((a, b) => a.order - b.order)
        .map((card) => card.id),
      destinationOrderedCardIds: items
        .filter((card) => card.listId === movedCard!.destinationListId)
        .sort((a, b) => a.order - b.order)
        .map((card) => card.id),
    });
  } else {
    await triggerCardReordered({
      boardId,
      actorUserId: userId,
      listId: reorderedListId,
      orderedCardIds: reorderedListId
        ? items
            .filter((card) => card.listId === reorderedListId)
            .sort((a, b) => a.order - b.order)
            .map((card) => card.id)
        : undefined,
    });
  }

  return { data: updatedCards };
};

export const updateCardOrder = createSafeAction(UpdateCardOrder, handler);
