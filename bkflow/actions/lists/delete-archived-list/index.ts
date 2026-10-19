"use server";

import { auth } from "@/server/auth";

import { revalidatePath } from "@/server/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerListDeleted } from "@/lib/boards/realtime";

import { DeleteArchivedList } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, boardId } = data;
  let list;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    list = await db.$transaction(async (tx) => {
      const existingList = await tx.list.findFirst({
        where: {
          id,
          boardId,
          archivedAt: {
            not: null,
          },
          board: {
            userId,
          },
        },
      });

      if (!existingList) {
        throw new Error("LIST_NOT_FOUND");
      }

      return tx.list.delete({
        where: {
          id: existingList.id,
        },
      });
    });

    await triggerListDeleted({
      boardId,
      listId: list.id,
      actorUserId: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LIST_NOT_FOUND") {
      return {
        error: "Không tìm thấy danh sách đã lưu trữ.",
      };
    }

    return {
      error: "Xóa vĩnh viễn danh sách thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const deleteArchivedList = createSafeAction(DeleteArchivedList, handler);
