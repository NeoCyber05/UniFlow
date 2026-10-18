"use server";

import { auth } from "@/server/auth";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "@/server/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { triggerChecklistItemMoved } from "@/lib/boards/realtime";
import { validateChecklistItemMove } from "@/lib/checklists/checklist-access";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { CHECKLIST_MESSAGES } from "@/lib/checklists/checklist-messages";
import { moveItems, toChecklistActionError } from "@/lib/checklists/checklist-mutations";
import {
  hasContiguousOrders,
  sortItemIds,
} from "@/lib/checklists/checklist-order-rules";

import { MoveChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const {
    boardId,
    cardId,
    itemId,
    sourceChecklistId,
    destinationChecklistId,
    sourceItems,
    destinationItems,
    expectedSourceOrderVersion,
    expectedDestinationOrderVersion,
  } = data;

  try {
    if (
      !hasContiguousOrders(sourceItems) ||
      !hasContiguousOrders(destinationItems)
    ) {
      return { error: CHECKLIST_MESSAGES.invalidItemOrder };
    }

    const access = await validateChecklistItemMove({
      boardId,
      cardId,
      sourceChecklistId,
      destinationChecklistId,
      itemId,
      
      userId,
      sourceItems,
      destinationItems,
    });

    if (access.error || !access.sourceChecklist || !access.destinationChecklist) {
      return { error: access.error || CHECKLIST_MESSAGES.moveItemGeneric };
    }

    const { items: updatedItems, sourceOrderVersion, destinationOrderVersion } =
      await db.$transaction((tx) =>
        moveItems(tx, {
          sourceChecklistId,
          destinationChecklistId,
          expectedSourceOrderVersion,
          expectedDestinationOrderVersion,
          sourceItems,
          destinationItems,
        }),
      );

    const verifiedCard = access.sourceChecklist.card;
    const verifiedBoardId = verifiedCard.list.boardId;

    const movedItem = updatedItems.find((item) => item.id === itemId);
    const itemTitle = movedItem ? movedItem.title : "Mục công việc";

    await createAuditLog({
      entityId: itemId,
      entityTitle: `detail:đã di chuyển mục công việc "${itemTitle}" từ danh sách công việc "${access.sourceChecklist.title}" sang danh sách công việc "${access.destinationChecklist.title}"`,
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId: verifiedBoardId,
      cardId: verifiedCard.id,
    });

    await triggerChecklistItemMoved({
      boardId: verifiedBoardId,
      cardId: verifiedCard.id,
      checklistItemId: itemId,
      sourceChecklistId: access.sourceChecklist.id,
      destinationChecklistId: access.destinationChecklist.id,
      actorUserId: userId,
      sourceOrderedItemIds: sortItemIds(sourceItems),
      destinationOrderedItemIds: sortItemIds(destinationItems),
    });

    revalidatePath(`/board/${verifiedBoardId}`);
    return { data: { items: updatedItems, sourceOrderVersion, destinationOrderVersion } };
  } catch (error) {
    const known = toChecklistActionError(error);
    if (known) return known;
    console.error("[MOVE_CHECKLIST_ITEM_ERROR]", error);
    return { error: CHECKLIST_MESSAGES.moveItemFailed };
  }
};

export const moveChecklistItem = createSafeAction(MoveChecklistItem, handler);
