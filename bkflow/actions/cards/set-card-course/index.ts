"use server";

import { auth } from "@/server/auth";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

import { triggerCardUpdated } from "@/lib/cards/realtime";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

import { SetCardCourse } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { id, boardId, courseId } = data;

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const cardWhere = {
      id,
      archivedAt: null,
      list: {
        archivedAt: null,
        board: { id: boardId, orgId },
      },
    };

    const currentCard = await db.card.findFirst({ where: cardWhere });

    if (!currentCard) {
      return { error: "Không tìm thấy thẻ." };
    }

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
      return { error: "Môn không hợp lệ." };
    }

    const card = await db.card.update({
      where: { id },
      data: { courseId },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: course
        ? `detail:đã chuyển thẻ "${card.title}" sang môn "${course.name}"`
        : `detail:đã chuyển thẻ "${card.title}" về Cá nhân`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      boardId,
      cardId: card.id,
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
    return { error: "Cập nhật môn của thẻ thất bại." };
  }
};

export const setCardCourse = createSafeAction(SetCardCourse, handler);
