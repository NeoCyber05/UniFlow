import { triggerCardCreated } from "@/lib/boards/realtime";
import { logger } from "@/lib/logger";
import type { CardWithAssignees } from "@/types";

/**
 * Realtime for newly created cards. Runs after the DB commit and never throws:
 * a failure here must not make a client retry (the cards already exist).
 */
export const announceCapturedCards = async (input: {
  cards: CardWithAssignees[];
  createdIds: Set<string>;
  boardId: string;
  userId: string;
}) => {
  const created = input.cards.filter((card) => input.createdIds.has(card.id));

  await Promise.all(created.map(async (card) => {
    try {
      await triggerCardCreated({
        boardId: input.boardId,
        listId: card.listId,
        cardId: card.id,
        actorUserId: input.userId,
      });
    } catch (error) {
      logger.warn("[CAPTURED_CARDS_EFFECTS]", { error, cardId: card.id });
    }
  }));
};
