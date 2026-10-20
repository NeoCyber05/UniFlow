"use server";

import { Prisma } from "@prisma/client";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

import { UpdateWorkspace } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { id, title, icon, color } = data;

  try {
    const existing = await db.workspace.findUnique({ where: { id }, select: { userId: true } });

    if (!existing || existing.userId !== userId) {
      return { error: "Không tìm thấy workspace." };
    }

    // Tên bảng workspace luôn theo tên workspace
    const [workspace] = await db.$transaction([
      db.workspace.update({ where: { id }, data: { title, icon, color } }),
      db.board.updateMany({ where: { workspaceId: id, userId }, data: title ? { title } : {} }),
    ]);

    return { data: workspace };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Đã có workspace cùng tên." };
    }
    return { error: "Cập nhật workspace thất bại." };
  }
};

export const updateWorkspace = createSafeAction(UpdateWorkspace, handler);
