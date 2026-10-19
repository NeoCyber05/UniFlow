import { BoardType, Prisma } from "@prisma/client";

import { pickNextCourseColor } from "@/lib/courses/course-colors";
import { parseCourseRef, type CourseRef } from "@/lib/courses/hust-catalog";
import { db } from "@/lib/db";

/**
 * Đổi id ảo (`catalog:…`, `custom:…`) thành id Course thật của bảng, tạo môn nếu chưa có.
 * id thật/null trả nguyên; bảng không phải học kỳ → null (bảng đó không có môn).
 * Gọi sau khi đã kiểm quyền sửa bảng.
 */
export const resolveCourseRef = async (boardId: string, courseId: string | null | undefined) => {
  const ref = parseCourseRef(courseId);

  return ref ? ensureCourse(boardId, ref) : courseId ?? null;
};

/** Môn có cùng mã (hoặc cùng tên) trong bảng học kỳ; chưa có thì tạo. Bảng khác → null. */
export const ensureCourse = async (boardId: string, ref: CourseRef) => {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { boardType: true, courses: { select: { id: true, name: true, code: true, color: true, order: true } } },
  });

  if (!board || board.boardType !== BoardType.SEMESTER) return null;

  const find = (courses: typeof board.courses) => courses.find((course) =>
    (ref.code && course.code?.toUpperCase() === ref.code.toUpperCase()) ||
    course.name.toLowerCase() === ref.name.toLowerCase(),
  );
  const existing = find(board.courses);

  if (existing) return existing.id;

  try {
    const course = await db.course.create({
      data: {
        boardId,
        name: ref.name,
        code: ref.code,
        color: pickNextCourseColor(board.courses.map((course) => course.color)),
        order: Math.max(0, ...board.courses.map((course) => course.order)) + 1,
      },
      select: { id: true },
    });
    return course.id;
  } catch (error) {
    // Hai lần gửi cùng lúc tạo trùng tên: dùng môn bản kia vừa tạo
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const course = await db.course.findFirst({ where: { boardId, name: ref.name }, select: { id: true } });
      if (course) return course.id;
    }
    throw error;
  }
};
