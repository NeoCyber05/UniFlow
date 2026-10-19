"use server";

import { auth } from "@/server/auth";
import { Prisma } from "@prisma/client";

import { createSafeAction } from "@/lib/create-safe-action";
import {
  DUPLICATE_COURSE_ERROR,
  INVALID_COURSE_ERROR,
  isCourseInBoard,
  requireSemesterBoardEditor,
} from "@/lib/courses/course-guards";
import { db } from "@/lib/db";

import { UpdateCourse } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { id, boardId, name, code, credits, color } = data;

  try {
    const guard = await requireSemesterBoardEditor({ boardId, userId });

    if (guard.error) {
      return { error: guard.error };
    }

    if (!(await isCourseInBoard(id, boardId))) {
      return { error: INVALID_COURSE_ERROR };
    }

    const course = await db.course.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code || null } : {}),
        ...(credits !== undefined ? { credits } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });

    return { data: course };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: DUPLICATE_COURSE_ERROR };
    }

    return { error: "Cập nhật môn học thất bại." };
  }
};

export const updateCourse = createSafeAction(UpdateCourse, handler);
