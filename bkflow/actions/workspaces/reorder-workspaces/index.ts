"use server";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

import { ReorderWorkspaces } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  try {
    // updateMany + userId trong where → không sửa được workspace của người khác
    const results = await db.$transaction(
      data.items.map((item) =>
        db.workspace.updateMany({ where: { id: item.id, userId }, data: { order: item.order } }),
      ),
    );

    return { data: { count: results.reduce((sum, result) => sum + result.count, 0) } };
  } catch {
    return { error: "Sắp xếp workspace thất bại." };
  }
};

export const reorderWorkspaces = createSafeAction(ReorderWorkspaces, handler);
