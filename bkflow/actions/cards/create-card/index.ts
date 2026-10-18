"use server";

import { auth } from "@/server/auth";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";
import { validateCardDateRange } from "@/lib/cards/card-date-rules";
import { validateTaskSchedule } from "@/lib/cards/task-schedule";
import { toTaskDeadlineStorage, toTaskScheduleStorage } from "@/lib/cards/task-schedule-storage";
import { isCourseInBoard } from "@/lib/courses/course-guards";

import { CreateCard } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const {
    title, boardId, listId, startDate, dueDate, courseId,
    deadlineOn, scheduledOn, scheduledStartAt, scheduledEndAt,
  } = data;
  let card;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const list = await db.list.findFirst({
      where: {
        id: listId,
        archivedAt: null,
        board: {
          id: boardId,
          userId,
        },
      },
    });

    if (!list) {
      return {
        error: "Không tìm thấy danh sách.",
      };
    }

    if (courseId && !(await isCourseInBoard(courseId, boardId))) {
      return {
        error: "Môn không hợp lệ.",
      };
    }

    const lastCard = await db.card.findFirst({
      where: {
        listId,
        archivedAt: null,
      },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newOrder = lastCard ? lastCard.order + 1 : 1;

    const dateRangeError = validateCardDateRange(
      startDate ?? null,
      dueDate ?? null,
    );

    if (dateRangeError) {
      return {
        error: dateRangeError,
      };
    }

    if (dueDate && deadlineOn) {
      return { error: "Hạn nộp chỉ có ngày hoặc có giờ, không đồng thời." };
    }

    const schedule = {
      scheduledOn: scheduledOn ?? null,
      scheduledStartAt: scheduledStartAt ?? null,
      scheduledEndAt: scheduledEndAt ?? null,
    };
    const scheduleError = validateTaskSchedule(schedule);

    if (scheduleError) {
      return { error: scheduleError };
    }

    card = await db.card.create({
      data: {
        title,
        listId,
        order: newOrder,
        ...(courseId ? { courseId } : {}),
        ...(startDate !== undefined ? { startDate } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(deadlineOn ? { deadlineOn: toTaskDeadlineStorage({ dueDate: null, deadlineOn }).deadlineOn } : {}),
        ...(scheduledOn || scheduledStartAt ? toTaskScheduleStorage(schedule) : {}),
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã thêm thẻ "${card.title}" vào danh sách "${list.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.CREATE,
      boardId,
      cardId: card.id,
    });

    await triggerCardCreated({
      boardId,
      listId,
      cardId: card.id,
      actorUserId: userId,
    });
  } catch {
    return {
      error: "Tạo thẻ thất bại."
    }
  }

  return { data: card };
};

export const createCard = createSafeAction(CreateCard, handler);
