import type { BoardType, Course } from "@prisma/client";

import { db } from "@/lib/db";

export type BoardCourse = Pick<Course, "id" | "name" | "code" | "credits" | "color" | "order">;

export type BoardCoursesResponse = {
  boardType: BoardType;
  courses: BoardCourse[];
};

export const BOARD_COURSE_SELECT = {
  id: true,
  name: true,
  code: true,
  credits: true,
  color: true,
  order: true,
} as const;

export const getBoardCourses = async (boardId: string): Promise<BoardCourse[]> => {
  if (!db.course) {
    return [];
  }

  return db.course.findMany({
    where: { boardId },
    select: BOARD_COURSE_SELECT,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
};
