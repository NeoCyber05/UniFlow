"use server";

import { auth } from "@/server/auth";
import { Prisma } from "@prisma/client";

import { createSafeAction } from "@/lib/create-safe-action";
import { DUPLICATE_COURSE_ERROR, requireSemesterBoardEditor } from "@/lib/courses/course-guards";
import { db } from "@/lib/db";

import { CreateCourse } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, name, code, credits, color } = data;

  try {
    const guard = await requireSemesterBoardEditor({ boardId, userId });

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

    return { data: course };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: DUPLICATE_COURSE_ERROR };
    }

    return { error: "Thêm môn học thất bại." };
  }
};

export const createCourse = createSafeAction(CreateCourse, handler);
