"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { announceCapturedCards } from "@/lib/cards/captured-cards-effects";
import { CapturedCardsError, createCapturedCardsWithStatus } from "@/lib/cards/create-captured-cards";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireBoardEditor } from "@/lib/permissions";

import { CreateSmartCaptureCards } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, drafts } = data;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const { cards, createdIds } = await createCapturedCardsWithStatus({ userId, boardId, drafts });

    const lists = await db.list.findMany({
      where: { id: { in: cards.map((card) => card.listId) } },
      select: { id: true, title: true },
    });

    await announceCapturedCards({
      cards,
      createdIds,
      boardId,
      userId,

    });

    revalidatePath(`/board/${boardId}`);

    return { data: cards };
  } catch (error) {
    if (error instanceof CapturedCardsError) {
      return { error: error.message, ...(error.code ? { errorCode: error.code } : {}) };
    }

    logger.error("[CREATE_SMART_CAPTURE_CARDS_ERROR]", error, {
      action: "create-smart-capture-cards",
      aiFeature: "smart-capture",
      userId,
      boardId,
      draftCount: drafts.length,
    });

    return { error: "Tạo thẻ từ Smart Capture thất bại." };
  }
};

export const createSmartCaptureCards = createSafeAction(CreateSmartCaptureCards, handler);
