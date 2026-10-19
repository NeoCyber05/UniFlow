"use server";

import { createHash } from "node:crypto";

import { ACTION, ENTITY_TYPE, type Prisma } from "@prisma/client";

import { auth } from "@/server/auth";

import { zonedTimeToIso } from "@/lib/capture/analysis";
import { expandTimetable, IMAGE_IMPORT_TIME_ZONE, type ImageTaskItem } from "@/lib/capture/image-import";
import { toTaskDeadlineStorage, toTaskScheduleStorage } from "@/lib/cards/task-schedule-storage";
import { ensureCourse } from "@/lib/courses/course-ref";
import { HUST_COURSES } from "@/lib/courses/hust-catalog";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireBoardEditorForUser } from "@/lib/permissions";

import { ImportImageItems } from "./schema";
import { InputType, ReturnType } from "./types";

const TIMETABLE_LIST_TITLE = "Lịch học";
const FALLBACK_LIST_TITLE = "Cần làm";

/** id cố định theo nội dung → nhập lại cùng ảnh không tạo trùng (createMany skipDuplicates). */
const stableId = (...parts: string[]) => {
  const hex = createHash("sha256").update(parts.join("|")).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const findOrCreateList = async (boardId: string, title: string | null) => {
  const lists = await db.list.findMany({
    where: { boardId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, title: true, order: true },
  });
  const found = title ? lists.find((list) => list.title === title) : lists[0];
  if (found) return found.id;
  const created = await db.list.create({
    data: { boardId, title: title ?? FALLBACK_LIST_TITLE, order: (lists.at(-1)?.order ?? 0) + 1 },
    select: { id: true },
  });
  return created.id;
};

const itemDates = (item: ImageTaskItem) => {
  const at = (time: string | null) => (item.date && time ? zonedTimeToIso(item.date, time, IMAGE_IMPORT_TIME_ZONE) : null);

  if (item.kind === "EVENT") {
    const start = at(item.start);
    const end = at(item.end) ?? (start ? new Date(new Date(start).getTime() + 60 * 60_000).toISOString() : null);
    return toTaskScheduleStorage(start && end && end > start
      ? { scheduledOn: null, scheduledStartAt: start, scheduledEndAt: end }
      : { scheduledOn: item.date, scheduledStartAt: null, scheduledEndAt: null });
  }

  const due = at(item.start);
  return toTaskDeadlineStorage(due ? { dueDate: due, deadlineOn: null } : { dueDate: null, deadlineOn: item.date });
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, week1Start, sessions = [], items = [] } = data;

  try {
    const permission = await requireBoardEditorForUser({ boardId, userId });

    if (permission.error || !permission.membership) {
      return { error: permission.error ?? "Không có quyền truy cập." };
    }

    // Môn theo mã: mỗi mã gọi ensureCourse một lần (tạo nếu chưa có, bảng không phải học kỳ → null)
    const courseIds = new Map<string, string | null>();
    const courseIdFor = async (code: string | null, name: string | null) => {
      const key = (code ?? name ?? "").toUpperCase();
      if (!key) return null;
      if (!courseIds.has(key)) {
        const catalogName = code ? HUST_COURSES.find((course) => course.code.toUpperCase() === code.toUpperCase())?.name : undefined;
        courseIds.set(key, await ensureCourse(boardId, { code, name: name ?? catalogName ?? code! }));
      }
      return courseIds.get(key) ?? null;
    };

    const rows: Prisma.CardCreateManyInput[] = [];

    if (sessions.length > 0) {
      const listId = await findOrCreateList(boardId, TIMETABLE_LIST_TITLE);
      for (const { session, date } of expandTimetable(sessions, week1Start!)) {
        const start = zonedTimeToIso(date, session.start, IMAGE_IMPORT_TIME_ZONE);
        const end = zonedTimeToIso(date, session.end, IMAGE_IMPORT_TIME_ZONE);
        if (!start || !end || end <= start) continue;
        rows.push({
          id: stableId(boardId, session.code ?? session.name, start),
          listId,
          kind: "EVENT",
          title: session.note ? `${session.name} (${session.note})` : session.name,
          description: session.room ? `Phòng: ${session.room}` : null,
          scheduledStartAt: new Date(start),
          scheduledEndAt: new Date(end),
          courseId: await courseIdFor(session.code, session.name),
          order: rows.length + 1,
        });
      }
    }

    if (items.length > 0) {
      const listId = await findOrCreateList(boardId, null);
      for (const item of items) {
        rows.push({
          id: stableId(boardId, item.kind, item.title, item.date ?? "", item.start ?? ""),
          listId,
          kind: item.kind,
          title: item.title,
          description: item.description,
          ...itemDates(item),
          courseId: await courseIdFor(item.courseCode, null),
          order: rows.length + 1,
        });
      }
    }

    if (rows.length === 0) {
      return { error: "Không có mục hợp lệ để tạo." };
    }

    // shortcut: order đặt 1..n trong lượt nhập, có thể trùng order thẻ cũ cùng cột; đủ cho cột "Lịch học" riêng
    const { count } = await db.card.createMany({ data: rows, skipDuplicates: true });

    if (count > 0) {
      await createAuditLog({
        entityId: boardId,
        entityTitle: `detail:đã nhập ${count} mục từ ảnh`,
        entityType: ENTITY_TYPE.BOARD,
        action: ACTION.CREATE,
        boardId,
      });
    }

    return { data: { created: count, total: rows.length } };
  } catch (error) {
    logger.error("[IMPORT_IMAGE_ITEMS_ERROR]", error, { action: "import-image-items", userId });
    return { error: "Tạo lịch từ ảnh thất bại." };
  }
};

export const importImageItems = createSafeAction(ImportImageItems, handler);
