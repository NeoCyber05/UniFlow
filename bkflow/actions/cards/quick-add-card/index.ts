"use server";

import { auth } from "@/server/clerk";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditorForUser } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";
import { isAssignableBoardMember } from "@/lib/boards/board-member-role";
import { isCourseInBoard } from "@/lib/courses/course-guards";
import {
  NO_CURRENT_SEMESTER_ERROR,
  resolveCurrentSemesterBoardId,
} from "@/lib/my-tasks/current-semester-board";

import { QuickAddCard } from "./schema";
import { InputType, ReturnType } from "./types";

const FALLBACK_LIST_TITLE = "Cần làm";

const resolveTargetList = async (boardId: string, listId?: string) => {
  if (listId) {
    return db.list.findFirst({
      where: { id: listId, boardId, archivedAt: null },
      select: { id: true, title: true },
    });
  }

  const firstList = await db.list.findFirst({
    where: { boardId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });

  if (firstList) return firstList;

  return db.list.create({
    data: { boardId, title: FALLBACK_LIST_TITLE, order: 1 },
    select: { id: true, title: true },
  });
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { title, courseId, dueDate } = data;
  const assigneeUserIds = Array.from(new Set(data.assigneeUserIds ?? []));
  let card;

  try {
    const boardId = data.boardId ?? (await resolveCurrentSemesterBoardId(userId));

    if (!boardId) {
      return { error: NO_CURRENT_SEMESTER_ERROR, errorCode: "NO_CURRENT_SEMESTER" };
    }

    const permission = await requireBoardEditorForUser({ boardId, userId });

    if (permission.error || !permission.membership) {
      return { error: permission.error ?? "Không có quyền truy cập." };
    }

    const list = await resolveTargetList(boardId, data.listId);

    if (!list) {
      return { error: "Không tìm thấy danh sách." };
    }

    if (courseId && !(await isCourseInBoard(courseId, boardId))) {
      return { error: "Môn không hợp lệ." };
    }

    const assignees = assigneeUserIds.length > 0
      ? (await db.boardMember.findMany({
          where: { boardId, userId: { in: assigneeUserIds } },
        })).filter(isAssignableBoardMember)
      : [];

    if (assignees.length !== assigneeUserIds.length) {
      return { error: "Người được giao không hợp lệ." };
    }

    const lastCard = await db.card.findFirst({
      where: { listId: list.id, archivedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const hasUserState = Boolean(data.isImportant || data.myDay);

    card = await db.card.create({
      data: {
        title,
        listId: list.id,
        order: lastCard ? lastCard.order + 1 : 1,
        ...(courseId ? { courseId } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(assignees.length > 0
          ? { assignees: { create: assignees.map((member) => ({ boardMemberId: member.id })) } }
          : {}),
        ...(hasUserState
          ? {
              userStates: {
                create: {
                  userId,
                  isImportant: Boolean(data.isImportant),
                  myDayAt: data.myDay ? new Date() : null,
                },
              },
            }
          : {}),
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã thêm thẻ "${card.title}" vào danh sách "${list.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.CREATE,
      boardId,
      cardId: card.id,
      orgId: permission.membership.board.orgId,
    });

    await triggerCardCreated({
      boardId,
      listId: list.id,
      cardId: card.id,
      actorUserId: userId,
    });
  } catch {
    return { error: "Tạo việc thất bại." };
  }

  return { data: card };
};

export const quickAddCard = createSafeAction(QuickAddCard, handler);
