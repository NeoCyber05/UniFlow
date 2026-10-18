"use server";

import { auth } from "@/server/clerk";

import { createSafeAction } from "@/lib/create-safe-action";
import { requireSemesterBoardEditor } from "@/lib/courses/course-guards";
import { db } from "@/lib/db";

import { ReorderCourses } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, items } = data;

  try {
    const guard = await requireSemesterBoardEditor({ boardId, orgId, userId });

    if (guard.error) {
      return { error: guard.error };
    }

    // updateMany + boardId trong where → không sửa được môn của bảng khác
    const results = await db.$transaction(
      items.map((item) =>
        db.course.updateMany({
          where: { id: item.id, boardId },
          data: { order: item.order },
        }),
      ),
    );

    return { data: { count: results.reduce((sum, result) => sum + result.count, 0) } };
  } catch {
    return { error: "Sắp xếp môn học thất bại." };
  }
};

export const reorderCourses = createSafeAction(ReorderCourses, handler);
