"use server";

import { randomUUID } from "node:crypto";

import { auth } from "@/server/auth";

import { formatSourceDescription } from "@/lib/capture/source";
import { announceCapturedCards } from "@/lib/cards/captured-cards-effects";
import { CapturedCardsError, createCapturedCardsWithStatus } from "@/lib/cards/create-captured-cards";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { logger } from "@/lib/logger";
import { requireBoardEditorForUser } from "@/lib/permissions";
import {
  NO_CURRENT_SEMESTER_ERROR,
  resolveCurrentSemesterBoardId,
} from "@/lib/my-tasks/current-semester-board";

import { QuickAddCard } from "./schema";
import { InputType, ReturnType } from "./types";

const FALLBACK_LIST_TITLE = "Cần làm";
const DESCRIPTION_MAX_LENGTH = 3_000;

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

  const description = data.source ? formatSourceDescription(data.source) : "";

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    // Never truncate the source silently; the composer keeps the draft for the user to shorten.
    return { error: "Trích đoạn nguồn quá dài. Hãy rút gọn đoạn chọn hoặc bỏ đính kèm nguồn." };
  }

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

    const { cards, createdIds } = await createCapturedCardsWithStatus({
      userId,
      boardId,
      drafts: [{
        creationId: data.creationId ?? randomUUID(),
        listId: list.id,
        title: data.title,
        description,
        courseId: data.courseId ?? null,
        dueDate: data.dueDate ?? null,
        deadlineOn: data.deadlineOn ?? null,
        scheduledOn: data.scheduledOn ?? null,
        scheduledStartAt: data.scheduledStartAt ?? null,
        scheduledEndAt: data.scheduledEndAt ?? null,
        reminder: data.reminder && data.reminder !== "none" ? data.reminder : null,
        checklistItems: data.checklistItems ?? [],
        isImportant: Boolean(data.isImportant),
        myDay: Boolean(data.myDay),
      }],
    });

    await announceCapturedCards({
      cards,
      createdIds,
      boardId,
      userId,
      listTitles: new Map([[list.id, list.title]]),
      via: "quick-add",
    });

    return { data: cards[0] };
  } catch (error) {
    if (error instanceof CapturedCardsError) {
      return { error: error.message, ...(error.code ? { errorCode: error.code } : {}) };
    }

    logger.error("[QUICK_ADD_CARD_ERROR]", error, { action: "quick-add-card", userId });

    return { error: "Tạo việc thất bại." };
  }
};

export const quickAddCard = createSafeAction(QuickAddCard, handler);
