"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { DeleteBoard } from "./schema";
import { InputType, ReturnType } from "./types";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { requireBoardAdmin } from "@/lib/permissions";
import { triggerBoardDeleted } from "@/lib/boards/realtime";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id } = data;
  let board;

  try {
    const permission = await requireBoardAdmin({ boardId: id, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    board = await db.board.delete({
      where: {
        id,
        orgId,
      },
    });

    await createAuditLog({
      entityTitle: board.title,
      entityId: board.id,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.DELETE,
      boardId: board.id,
    })

    await triggerBoardDeleted({
      boardId: board.id,
      orgId,
      actorUserId: userId,
    });
  } catch {
    return {
      error: "Xóa bảng thất bại."
    }
  }

  revalidatePath(`/organization/${orgId}`);
  return { data: board };
};

export const deleteBoard = createSafeAction(DeleteBoard, handler);
