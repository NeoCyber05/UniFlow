"use server";

import { auth } from "@/server/auth";

import { format } from "date-fns";
import { revalidatePath } from "@/server/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getChecklistItemAccess } from "@/lib/checklists/checklist-access";
import { triggerChecklistItemDueDateUpdated } from "@/lib/boards/realtime";

import { SetChecklistItemDueDate } from "./schema";
import { InputType, ReturnType } from "./types";

const formatChecklistDueDate = (date: Date) => format(date, "dd/MM/yyyy HH:mm");

const getChecklistDueDateRangeError = (cardDueDate: Date) =>
  `Hạn checklist phải trước hoặc bằng hạn chót của thẻ (${formatChecklistDueDate(cardDueDate)}).`;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, id, dueDate } = data;

  try {
    const access = await getChecklistItemAccess({
      boardId,
      cardId,
      itemId: id,

      userId,
    });

    if (access.error || !access.item) {
      return { error: access.error || "Không tìm thấy mục công việc." };
    }

    const currentTime = access.item.dueDate?.getTime() ?? null;
    const nextTime = dueDate?.getTime() ?? null;

    if (currentTime === nextTime) {
      return { data: access.item };
    }

    const parentCardDueDate = access.item.checklist.card.dueDate;

    if (
      dueDate &&
      parentCardDueDate &&
      dueDate.getTime() > parentCardDueDate.getTime()
    ) {
      return {
        error: getChecklistDueDateRangeError(parentCardDueDate),
      };
    }

    const item = await db.checklistItem.update({
      where: {
        id,
      },
      data: {
        dueDate,
      },
    });

    await triggerChecklistItemDueDateUpdated({
      boardId: access.item.checklist.card.list.boardId,
      cardId: access.item.checklist.cardId,
      checklistId: access.item.checklistId,
      checklistItemId: item.id,
      actorUserId: userId,
      dueDate: item.dueDate,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: item };
  } catch (error) {
    console.error("[SET_CHECKLIST_ITEM_DUE_DATE_ERROR]", error);
    return { error: "Cập nhật ngày hết hạn thất bại." };
  }
};

export const setChecklistItemDueDate = createSafeAction(SetChecklistItemDueDate, handler);
