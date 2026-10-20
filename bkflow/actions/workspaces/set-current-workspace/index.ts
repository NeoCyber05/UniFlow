"use server";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

import { SetCurrentWorkspace } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { id } = data;

  try {
    const existing = await db.workspace.findUnique({ where: { id }, select: { userId: true } });

    if (!existing || existing.userId !== userId) {
      return { error: "Không tìm thấy workspace." };
    }

    const [, workspace] = await db.$transaction([
      db.workspace.updateMany({ where: { userId, isCurrent: true }, data: { isCurrent: false } }),
      db.workspace.update({ where: { id }, data: { isCurrent: true } }),
    ]);

    return { data: workspace };
  } catch {
    return { error: "Chuyển workspace thất bại." };
  }
};

export const setCurrentWorkspace = createSafeAction(SetCurrentWorkspace, handler);
