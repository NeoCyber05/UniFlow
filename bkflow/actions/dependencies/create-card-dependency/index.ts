"use server";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { triggerRelatedDependencyCardsUpdated } from "@/lib/cards/realtime";
import { requireBoardEditor } from "@/lib/permissions";

import { CreateCardDependency } from "./schema";
import { InputType, ReturnType } from "./types";

const wouldCreateCycle = async ({
  boardId,
  userId,
  blockerCardId,
  blockedCardId,
}: {
  boardId: string;
  userId: string;
  orgId?: string;
  blockerCardId: string;
  blockedCardId: string;
}) => {
  const dependencies = await db.cardDependency.findMany({
    where: {
      blockerCard: {
        list: {
          board: {
            id: boardId,
            userId,
          },
        },
      },
    },
    select: {
      blockerCardId: true,
      blockedCardId: true,
    },
  });

  const blockedCardsByBlockerId = new Map<string, string[]>();

  for (const dependency of dependencies) {
    const blockedCards = blockedCardsByBlockerId.get(dependency.blockerCardId) ?? [];

    blockedCards.push(dependency.blockedCardId);
    blockedCardsByBlockerId.set(dependency.blockerCardId, blockedCards);
  }

  const queue = [blockedCardId];
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const currentCardId = queue.shift()!;

    if (currentCardId === blockerCardId) {
      return true;
    }

    const nextCardIds = blockedCardsByBlockerId.get(currentCardId) ?? [];

    for (const nextCardId of nextCardIds) {
      if (visited.has(nextCardId)) {
        continue;
      }

      visited.add(nextCardId);
      queue.push(nextCardId);
    }
  }

  return false;
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, blockerCardId, blockedCardId } = data;

  if (blockerCardId === blockedCardId) {
    return {
      error: "Một thẻ không thể phụ thuộc vào chính nó.",
    };
  }

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const cards = await db.card.findMany({
      where: {
        id: {
          in: [blockerCardId, blockedCardId],
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
      select: {
        id: true,
        title: true,
      },
    });

    const blockerCard = cards.find((card) => card.id === blockerCardId);
    const blockedCard = cards.find((card) => card.id === blockedCardId);

    if (!blockerCard || !blockedCard) {
      return {
        error: "Không tìm thấy thẻ hoặc thẻ không thuộc bảng này.",
      };
    }

    const existingDependency = await db.cardDependency.findUnique({
      where: {
        blockerCardId_blockedCardId: {
          blockerCardId,
          blockedCardId,
        },
      },
    });

    if (existingDependency) {
      return {
        error: "Liên kết phụ thuộc này đã tồn tại.",
      };
    }

    const createsCycle = await wouldCreateCycle({
      boardId,
      userId,
      blockerCardId,
      blockedCardId,
    });

    if (createsCycle) {
      return {
        error: "Không thể tạo liên kết phụ thuộc vì sẽ tạo vòng lặp.",
      };
    }

    const dependency = await db.cardDependency.create({
      data: {
        blockerCardId,
        blockedCardId,
      },
    });

    await triggerRelatedDependencyCardsUpdated({
      boardId,
      sourceCardId: blockerCard.id,
      relatedCardIds: [blockerCard.id, blockedCard.id],
      actorUserId: userId,
    });

    return { data: dependency };
  } catch (error) {
    console.error("[CREATE_CARD_DEPENDENCY_ERROR]", error);
    return {
      error: "Tạo liên kết phụ thuộc thất bại.",
    };
  }
};

export const createCardDependency = createSafeAction(CreateCardDependency, handler);
