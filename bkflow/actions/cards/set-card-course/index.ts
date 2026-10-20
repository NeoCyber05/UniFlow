"use server";

import { auth } from "@/server/auth";

import { triggerCardUpdated } from "@/lib/cards/realtime";
import { createSafeAction } from "@/lib/create-safe-action";
import { resolveCourseRef } from "@/lib/courses/course-ref";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

import { SetCardCourse } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { id, boardId } = data;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const cardWhere = {
      id,
      archivedAt: null,
      list: {
        archivedAt: null,
        board: { id: boardId, userId },
      },
    };

    const currentCard = await db.card.findFirst({ where: cardWhere });

    if (!currentCard) {
      return { error: "Không tìm thấy thẻ." };
    }

    const courseId = await resolveCourseRef(boardId, data.courseId);

    if (currentCard.courseId === courseId) {
      return { data: currentCard };
    }

    const course = courseId
      ? await db.course.findFirst({
          where: { id: courseId, boardId },
          select: { name: true },
        })
      : null;

    if (courseId && !course) {
      return { error: "Danh mục không hợp lệ." };
    }

    const card = await db.card.update({
      where: { id },
      data: { courseId },
    });

    await triggerCardUpdated({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      changedFields: ["courseId"],
      card,
      updatedAt: card.updatedAt,
    });

    return { data: card };
  } catch {
    return { error: "Cập nhật danh mục của thẻ thất bại." };
  }
};

export const setCardCourse = createSafeAction(SetCardCourse, handler);
