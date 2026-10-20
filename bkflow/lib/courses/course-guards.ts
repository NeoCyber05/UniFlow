import { BoardType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

export const COURSE_UNSUPPORTED_BOARD_ERROR = "Bảng này không hỗ trợ danh mục.";
export const INVALID_COURSE_ERROR = "Danh mục không hợp lệ.";
export const DUPLICATE_COURSE_ERROR = "Danh mục này đã có trong học kỳ.";

type GuardInput = {
  boardId: string;
  userId: string;
  orgId?: string;
};

/** Người sửa được bảng + bảng phải là bảng workspace. */
export const requireWorkspaceBoardEditor = async (input: GuardInput) => {
  const permission = await requireBoardEditor({ boardId: input.boardId, userId: input.userId });

  if (permission.error) {
    return { error: permission.error };
  }

  const board = await db.board.findFirst({
    where: { id: input.boardId, userId: input.userId },
    select: { boardType: true },
  });

  if (!board || board.boardType !== BoardType.WORKSPACE) {
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
