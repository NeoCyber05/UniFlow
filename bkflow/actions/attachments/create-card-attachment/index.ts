"use server";

import { auth } from "@/server/auth";
import { AttachmentType } from "@prisma/client";

import { createSafeAction } from "@/lib/create-safe-action";
import { triggerAttachmentCreated } from "@/lib/cards/realtime";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

import { CreateCardAttachment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { cardId, boardId, url } = data;
  const name = data.name?.trim() || url;

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
      select: {
        id: true,
        title: true,
      },
    });

    if (!card) {
      return {
        error: "Không tìm thấy thẻ.",
      };
    }

    const highestOrderAttachment = await db.cardAttachment.aggregate({
      where: {
        cardId: card.id,
        type: AttachmentType.LINK,
      },
      _max: {
        order: true,
      },
    });

    const attachment = await db.cardAttachment.create({
      data: {
        cardId: card.id,
        type: AttachmentType.LINK,
        order: (highestOrderAttachment._max.order ?? -1) + 1,
        name,
        url,
      },
    });

    await triggerAttachmentCreated({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      attachment,
    });

    return { data: attachment };
  } catch (error) {
    console.error("[CREATE_CARD_ATTACHMENT_ERROR]", error);
    return {
      error: "Thêm liên kết đính kèm thất bại.",
    };
  }
};

export const createCardAttachment = createSafeAction(CreateCardAttachment, handler);
