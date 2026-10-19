"use server";

import { auth } from "@/server/auth";

import { revalidatePath } from "@/server/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { validateChecklistItemsForReorder } from "@/lib/checklists/checklist-access";
import { triggerChecklistItemReordered } from "@/lib/boards/realtime";
import { CHECKLIST_MESSAGES } from "@/lib/checklists/checklist-messages";
import { reorderItems, toChecklistActionError } from "@/lib/checklists/checklist-mutations";

import { ReorderChecklistItems } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, checklistId, items, expectedOrderVersion } = data;

  try {
    const uniqueIds = new Set(items.map((item) => item.id));

    if (uniqueIds.size !== items.length) {
      return { error: CHECKLIST_MESSAGES.invalidOrderList };
    }

    const access = await validateChecklistItemsForReorder({
      boardId,
      cardId,
      checklistId,

      userId,
      items,
    });

    if (access.error || !access.checklist) {
      return { error: access.error || CHECKLIST_MESSAGES.checklistNotFound };
    }

    const { items: updatedItems, orderVersion } = await db.$transaction((tx) =>
      reorderItems(tx, { checklistId, expectedOrderVersion, items }),
    );
    const orderedItemIds = [...updatedItems]
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);
    const verifiedCard = access.checklist.card;
    const verifiedBoardId = verifiedCard.list.boardId;

    await triggerChecklistItemReordered({
      boardId: verifiedBoardId,
      cardId: verifiedCard.id,
      checklistId: access.checklist.id,
      actorUserId: userId,
      orderedItemIds,
    });

    revalidatePath(`/board/${verifiedBoardId}`);
    return { data: { items: updatedItems, orderVersion } };
  } catch (error) {
    const known = toChecklistActionError(error);
    if (known) return known;
    console.error("[REORDER_CHECKLIST_ITEMS_ERROR]", error);
    return { error: CHECKLIST_MESSAGES.reorderItemFailed };
  }
};

export const reorderChecklistItems = createSafeAction(ReorderChecklistItems, handler);
