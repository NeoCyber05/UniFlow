"use server";

import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import {
  triggerCardLabelAttached,
  triggerCardLabelDetached,
} from "@/lib/boards/realtime";

import { ToggleCardLabel } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { cardId, labelId, boardId } = data;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findFirst({
      where: {
        id: cardId,
        list: {
          board: {
            id: boardId,
            userId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const label = await db.label.findFirst({
      where: {
        id: labelId,
        boardId: card.list.boardId,
        board: {
          userId,
        },
      },
    });

    if (!label) {
      return { error: "Không tìm thấy nhãn." };
    }

    const existingCardLabel = await db.cardLabel.findUnique({
      where: {
        cardId_labelId: {
          cardId: card.id,
          labelId: label.id,
        },
      },
    });

    let toggled = false;

    if (existingCardLabel) {
      await db.cardLabel.delete({
        where: {
          cardId_labelId: {
            cardId: card.id,
            labelId: label.id,
          },
        },
      });
      toggled = false;
    } else {
      await db.cardLabel.create({
        data: {
          cardId: card.id,
          labelId: label.id,
        },
      });
      toggled = true;
    }

    const triggerCardLabel = toggled
      ? triggerCardLabelAttached
      : triggerCardLabelDetached;

    await triggerCardLabel({
      boardId: card.list.boardId,
      cardId: card.id,
      labelId: label.id,
      actorUserId: userId,
      labelName: label.title,
      labelColor: label.color,
    });

    return {
      data: {
        cardId: card.id,
        labelId: label.id,
        toggled,
      },
    };
  } catch {
    return {
      error: "Gắn nhãn thất bại.",
    };
  }
};

export const toggleCardLabel = createSafeAction(ToggleCardLabel, handler);
