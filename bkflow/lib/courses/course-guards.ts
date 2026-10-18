import { BoardType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

export const COURSE_UNSUPPORTED_BOARD_ERROR = "Bảng này không hỗ trợ môn học.";
export const INVALID_COURSE_ERROR = "Môn không hợp lệ.";
export const DUPLICATE_COURSE_ERROR = "Môn này đã có trong học kỳ.";

type GuardInput = {
  boardId: string;
  orgId: string;
  userId: string;
};

/** Người sửa được bảng + bảng phải là bảng học kỳ. */
export const requireSemesterBoardEditor = async (input: GuardInput) => {
  const permission = await requireBoardEditor(input);

  if (permission.error) {
    return { error: permission.error };
  }

  const board = await db.board.findFirst({
    where: { id: input.boardId, orgId: input.orgId },
    select: { boardType: true },
  });

  if (!board || board.boardType !== BoardType.SEMESTER) {
    return { error: COURSE_UNSUPPORTED_BOARD_ERROR };
  }

  return { error: null };
};

export const isCourseInBoard = async (courseId: string, boardId: string) => {
  const course = await db.course.findFirst({
    where: { id: courseId, boardId },
    select: { id: true },
  });

  return Boolean(course);
};
