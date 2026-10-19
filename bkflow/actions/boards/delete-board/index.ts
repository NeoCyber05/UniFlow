"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { DeleteBoard } from "./schema";
import { InputType, ReturnType } from "./types";

import { requireBoardAdmin } from "@/lib/permissions";
import { triggerBoardDeleted } from "@/lib/boards/realtime";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id } = data;
  let board;

  try {
    const permission = await requireBoardAdmin({ boardId: id, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    board = await db.board.delete({
      where: {
        id,
        userId,
      },
    });

    await triggerBoardDeleted({
      boardId: board.id,
      actorUserId: userId,
    });
  } catch {
    return {
      error: "Xóa bảng thất bại."
    }
  }

  revalidatePath("/dashboard");
  return { data: board };
};

export const deleteBoard = createSafeAction(DeleteBoard, handler);
