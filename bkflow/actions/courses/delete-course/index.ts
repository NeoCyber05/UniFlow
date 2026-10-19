"use server";

import { auth } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import {
  INVALID_COURSE_ERROR,
  isCourseInBoard,
  requireSemesterBoardEditor,
} from "@/lib/courses/course-guards";
import { db } from "@/lib/db";

import { DeleteCourse } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { id, boardId } = data;

  try {
    const guard = await requireSemesterBoardEditor({ boardId, userId });

    if (guard.error) {
      return { error: guard.error };
    }

    if (!(await isCourseInBoard(id, boardId))) {
      return { error: INVALID_COURSE_ERROR };
    }

    // Card.courseId có onDelete: SetNull → thẻ của môn chuyển về "Cá nhân"
    const course = await db.course.delete({ where: { id } });

    return { data: course };
  } catch {
    return { error: "Xóa môn học thất bại." };
  }
};

export const deleteCourse = createSafeAction(DeleteCourse, handler);
