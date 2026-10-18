"use server";

import { auth } from "@/server/clerk";
import { ACTION, ENTITY_TYPE, Prisma } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { DUPLICATE_COURSE_ERROR, requireSemesterBoardEditor } from "@/lib/courses/course-guards";
import { db } from "@/lib/db";

import { CreateCourse } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, name, code, credits, color } = data;

  try {
    const guard = await requireSemesterBoardEditor({ boardId, orgId, userId });

    if (guard.error) {
      return { error: guard.error };
    }

    const lastCourse = await db.course.findFirst({
      where: { boardId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const course = await db.course.create({
      data: {
        boardId,
        name,
        code: code || null,
        credits: credits ?? null,
        color,
        order: lastCourse ? lastCourse.order + 1 : 1,
      },
    });

    await createAuditLog({
      entityId: boardId,
      entityTitle: `detail:đã thêm môn học "${course.name}"`,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
      boardId,
    });

    return { data: course };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: DUPLICATE_COURSE_ERROR };
    }

    return { error: "Thêm môn học thất bại." };
  }
};

export const createCourse = createSafeAction(CreateCourse, handler);
