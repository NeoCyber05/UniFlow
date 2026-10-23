"use server";

import { auth } from "@/server/auth";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMemberForUser } from "@/lib/permissions";

import { SaveGraphPlan } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async ({ boardId, plan }: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const permission = await requireBoardMemberForUser({ boardId, userId });
  if (permission.error || !permission.membership) {
    return { error: permission.error || "Bạn không có quyền truy cập bảng này." };
  }

  try {
    const data = { ...plan, aiOrder: plan.aiOrder ?? Prisma.DbNull };
    await db.boardGraphPlan.upsert({
      where: { userId_boardId: { userId, boardId } },
      create: { userId, boardId, ...data },
      update: data,
    });
    return { data: plan };
  } catch {
    return { error: "Không lưu được thứ tự, thử lại sau." };
  }
};

export const saveGraphPlan = createSafeAction(SaveGraphPlan, handler);
