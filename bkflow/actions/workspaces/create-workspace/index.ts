"use server";

import { Prisma } from "@prisma/client";

import { auth } from "@/server/auth";

import { pickNextCourseColor } from "@/lib/courses/course-colors";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

import { CreateWorkspace } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  try {
    const existing = await db.workspace.findMany({ where: { userId }, select: { color: true, order: true } });

    // Workspace mới thành hiện tại để switcher mở ngay nó
    const [, workspace] = await db.$transaction([
      db.workspace.updateMany({ where: { userId, isCurrent: true }, data: { isCurrent: false } }),
      db.workspace.create({
        data: {
          userId,
          title: data.title,
          icon: data.icon ?? null,
          color: data.color ?? pickNextCourseColor(existing.map((workspace) => workspace.color)),
          order: Math.max(0, ...existing.map((workspace) => workspace.order)) + 1,
          isCurrent: true,
        },
      }),
    ]);

    return { data: workspace };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Đã có workspace cùng tên." };
    }
    return { error: "Tạo workspace thất bại." };
  }
};

export const createWorkspace = createSafeAction(CreateWorkspace, handler);
