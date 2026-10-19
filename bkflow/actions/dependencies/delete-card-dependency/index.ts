"use server";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { triggerRelatedDependencyCardsUpdated } from "@/lib/cards/realtime";
import { requireBoardEditor } from "@/lib/permissions";

import { DeleteCardDependency } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, dependencyId } = data;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const dependency = await db.cardDependency.findFirst({
      where: {
        id: dependencyId,
        blockerCard: {
          list: {
            board: {
              id: boardId,
              userId,
            },
          },
        },
        blockedCard: {
          list: {
            board: {
              id: boardId,
              userId,
            },
          },
        },
      },
      include: {
        blockerCard: {
          select: {
            id: true,
            title: true,
          },
        },
        blockedCard: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!dependency) {
      return {
        error: "Không tìm thấy liên kết phụ thuộc.",
      };
    }

    const deletedDependency = await db.cardDependency.delete({
      where: {
        id: dependency.id,
      },
    });

    await triggerRelatedDependencyCardsUpdated({
      boardId,
      sourceCardId: dependency.blockerCard.id,
      relatedCardIds: [dependency.blockerCard.id, dependency.blockedCard.id],
      actorUserId: userId,
    });

    return { data: deletedDependency };
  } catch (error) {
    console.error("[DELETE_CARD_DEPENDENCY_ERROR]", error);
    return {
      error: "Xóa liên kết phụ thuộc thất bại.",
    };
  }
};

export const deleteCardDependency = createSafeAction(DeleteCardDependency, handler);
