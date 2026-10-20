"use server";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

import { DeleteWorkspace } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { id } = data;

  try {
    const workspaces = await db.workspace.findMany({ where: { userId }, select: { id: true, isCurrent: true, order: true } });
    const target = workspaces.find((workspace) => workspace.id === id);

    if (!target) {
      return { error: "Không tìm thấy workspace." };
    }

    // Không cho xóa hết: getOrCreateWorkspaces sẽ tự tạo lại workspace mặc định
    if (workspaces.length === 1) {
      return { error: "Cần giữ ít nhất 1 workspace." };
    }

    const nextCurrent = target.isCurrent
      ? workspaces.filter((workspace) => workspace.id !== id).sort((a, b) => a.order - b.order)[0]
      : null;

    // Bảng gắn 1-1 với workspace; xóa workspace thì bảng (cùng list/card) đi theo
    const [, workspace] = await db.$transaction([
      db.board.deleteMany({ where: { workspaceId: id, userId } }),
      db.workspace.delete({ where: { id } }),
      ...(nextCurrent ? [db.workspace.update({ where: { id: nextCurrent.id }, data: { isCurrent: true } })] : []),
    ]);

    return { data: workspace };
  } catch {
    return { error: "Xóa workspace thất bại." };
  }
};

export const deleteWorkspace = createSafeAction(DeleteWorkspace, handler);
