import { ACTION, ENTITY_TYPE } from "@prisma/client";

import { triggerCardCreated } from "@/lib/boards/realtime";
import { createAuditLog } from "@/lib/create-audit-log";
import { logger } from "@/lib/logger";
import type { CardWithAssignees } from "@/types";

/**
 * Audit + realtime for newly created cards. Runs after the DB commit and never throws:
 * a failure here must not make a client retry (the cards already exist).
 */
export const announceCapturedCards = async (input: {
  cards: CardWithAssignees[];
  createdIds: Set<string>;
  boardId: string;
  userId: string;
  listTitles: Map<string, string>;
  /** Nguồn hiện trong nhật ký, mặc định Smart Capture. */
  origin?: string;
}) => {
  const created = input.cards.filter((card) => input.createdIds.has(card.id));

  await Promise.all(created.map(async (card) => {
    try {
      await createAuditLog({
        entityId: card.id,
        entityTitle: `detail:đã tạo thẻ "${card.title}" từ ${input.origin ?? "Smart Capture"} trong danh sách "${input.listTitles.get(card.listId) ?? ""}"`,
        entityType: ENTITY_TYPE.CARD,
        action: ACTION.CREATE,
        boardId: input.boardId,
        cardId: card.id,
      });
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
