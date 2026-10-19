"use server";

import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { UpdateList } from "./schema";
import { InputType, ReturnType } from "./types";

import { requireBoardEditor } from "@/lib/permissions";
import { triggerListUpdated } from "@/lib/boards/realtime";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { title, id, boardId } = data;
  let list;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const existingList = await db.list.findFirst({
      where: {
        id,
        boardId,
        archivedAt: null,
        board: {
          userId,
        },
      },
    });

    if (!existingList) {
      return { error: "Không tìm thấy danh sách." };
    }

    if (existingList.title === title) {
      return { data: existingList };
    }

    list = await db.list.update({
      where: {
        id,
        boardId,
        archivedAt: null,
        board: {
          userId,
        },
      },
      data: {
        title,
      },
    });

    await triggerListUpdated({
      boardId,
      listId: list.id,
      actorUserId: userId,
      title: list.title,
    });
  } catch {
    return {
      error: "Cập nhật danh sách thất bại."
    }
  }

  return { data: list };
};

export const updateList = createSafeAction(UpdateList, handler);
