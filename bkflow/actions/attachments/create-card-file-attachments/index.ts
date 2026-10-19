"use server";

import { auth } from "@/server/auth";
import { AttachmentType } from "@prisma/client";

import { createSafeAction } from "@/lib/create-safe-action";
import { triggerAttachmentCreated } from "@/lib/cards/realtime";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { utapi } from "@/lib/uploads/uploadthing-server";

import { CreateCardFileAttachments } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { cardId, boardId, files } = data;
  const fileKeys = files.map((file) => file.fileKey);

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

    let attachments;

    try {
      attachments = await db.$transaction(async (tx) => {
        const highestOrderAttachment = await tx.cardAttachment.aggregate({
          where: {
            cardId: card.id,
            type: AttachmentType.FILE,
          },
          _max: {
            order: true,
          },
        });

        const startOrder = (highestOrderAttachment._max.order ?? -1) + 1;

        return Promise.all(
          files.map((file, index) =>
            tx.cardAttachment.create({
              data: {
                cardId: card.id,
                type: AttachmentType.FILE,
                order: startOrder + index,
                name: file.name,
                url: file.url,
                fileKey: file.fileKey,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
              },
            }),
          ),
        );
      });
    } catch (error) {
      console.error("[CREATE_CARD_FILE_ATTACHMENTS_DB_ERROR]", {
        error,
        cardId,
        boardId,
        fileKeys,
      });

      try {
        await utapi.deleteFiles(fileKeys);
        console.info("[CREATE_CARD_FILE_ATTACHMENTS_ROLLBACK_SUCCESS]", {
          fileKeys,
          cardId,
          boardId,
        });
      } catch (cleanupError) {
        console.error("[CREATE_CARD_FILE_ATTACHMENTS_ROLLBACK_ERROR]", {
          error: cleanupError,
          fileKeys,
          cardId,
          boardId,
        });
      }

      return {
        error: "Lưu file đính kèm thất bại.",
      };
    }

    await Promise.all(
      attachments.map((attachment) =>
        triggerAttachmentCreated({
          boardId,
          cardId: card.id,
          actorUserId: userId,
          attachment,
        }),
      ),
    );

    return { data: attachments };
  } catch (error) {
    console.error("[CREATE_CARD_FILE_ATTACHMENTS_ERROR]", error);
    return {
      error: "Lưu file đính kèm thất bại.",
    };
  }
};

export const createCardFileAttachments = createSafeAction(CreateCardFileAttachments, handler);
