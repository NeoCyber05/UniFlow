import { NOTIFICATION_TYPE } from "@prisma/client";

import { getTaskDeadlineAt, hasDeadlineWhere } from "@/lib/cards/task-deadline";
import { createNotification } from "@/lib/notifications/create-notification";
import { db } from "@/lib/db";
import { getReminderTime, syncCardReminder } from "@/lib/notifications/reminder-deliveries";

export const reminderLabels: Record<string, string> = {
  "0": "Vao ngay thoi diem het han",
  "5": "5 phut truoc",
  "10": "10 phut truoc",
  "15": "15 phut truoc",
  "30": "30 phut truoc",
  "60": "1 gio truoc",
  "120": "2 gio truoc",
  "1440": "1 ngay truoc",
  "2880": "2 ngay truoc",
  "10080": "1 tuan truoc",
  "20160": "2 tuan truoc",
};

const getReminderDedupeKey = ({
  recipientUserId,
  cardId,
  reminder,
  reminderSetAt,
}: {
  recipientUserId: string;
  cardId: string;
  reminder: string;
  reminderSetAt: Date | null;
}) => {
  const reminderSetAtKey = reminderSetAt
    ? new Date(reminderSetAt).getTime()
    : "reminder";

  return `card-reminder:${recipientUserId}:${cardId}:${reminder}:${reminderSetAtKey}`;
};

export const getCardReminderKey = ({
  recipientUserId,
  cardId,
  generation,
}: {
  recipientUserId: string;
  cardId: string;
  generation: string;
}) => `card-reminder:${recipientUserId}:${cardId}:${generation}`;

type ReminderNotificationCard = {
  id: string;
  title: string;
  reminder: string | null;
  list: { title: string; board: { id: string; title: string } };
};

/** Dùng chung cho GET (fallback khi mở app) và worker: cùng dedupeKey nên không tạo hai thông báo. */
export const notifyCardReminder = ({
  card,
  recipientUserId,
  triggerTime,
  dueDate,
  dedupeKey,
}: {
  card: ReminderNotificationCard;
  recipientUserId: string;
  triggerTime: Date;
  dueDate: Date;
  dedupeKey: string;
}) =>
  createNotification({
    recipientUserId,
    type: NOTIFICATION_TYPE.CARD_REMINDER,
    title: "Sap den han",
    message: `Task "${card.title}" se het han theo moc nhac nho da thiet lap.`,
    boardId: card.list.board.id,
    boardTitle: card.list.board.title,
    cardId: card.id,
    cardTitle: card.title,
    listTitle: card.list.title,
    dueDate,
    triggerTime,
    reminderLabel: reminderLabels[card.reminder ?? ""] || "",
    dedupeKey,
  });

export const deleteCardReminderNotifications = async (cardId: string) => {
  await db.notification.deleteMany({
    where: {
      cardId,
      type: NOTIFICATION_TYPE.CARD_REMINDER,
    },
  });
};

export const ensureDueReminderNotifications = async ({
  userId,
}: {
  userId: string;
  orgId?: string;
}) => {
  const cards = await db.card.findMany({
    where: {
      archivedAt: null,
      list: {
        archivedAt: null,
        board: {
          userId,
        },
      },
      ...hasDeadlineWhere,
      reminder: {
        not: null,
        notIn: ["none"],
      },
      isCompleted: false,
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      deadlineOn: true,
      reminder: true,
      reminderSetAt: true,
      reminderGeneration: true,
      isCompleted: true,
      archivedAt: true,
      list: {
        select: {
          title: true,
          archivedAt: true,
          board: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const now = Date.now();
  const due: Parameters<typeof notifyCardReminder>[0][] = [];

  await Promise.all(
    cards.map(async (card) => {
      const at = getReminderTime(card);

      if (!at) {
        return;
      }

      const dueDate = getTaskDeadlineAt({
        dueDate: card.dueDate?.toISOString() ?? null,
        deadlineOn: card.deadlineOn?.toISOString().slice(0, 10) ?? null,
      });

      if (!dueDate) {
        return;
      }

      const generation = String(at.getTime());

      if (card.reminderGeneration !== generation) {
        // Chưa có phiên (task cũ trước khi có push): mốc tương lai thì lập phiên, mốc đã qua theo luật cũ bên dưới.
        if (at.getTime() > now) {
          await db.$transaction((tx) => syncCardReminder(tx, { cardId: card.id, now: new Date(now) }));
          return;
        }

        if (card.reminderSetAt && at.getTime() < new Date(card.reminderSetAt).getTime()) {
          return;
        }
      }

      if (now < at.getTime()) {
        return;
      }

      due.push({
        card,
        recipientUserId: userId,
        triggerTime: at,
        dueDate,
        dedupeKey: card.reminderGeneration === generation
          ? getCardReminderKey({ recipientUserId: userId, cardId: card.id, generation })
          : getReminderDedupeKey({
            recipientUserId: userId,
            cardId: card.id,
            reminder: card.reminder!,
            reminderSetAt: card.reminderSetAt,
          }),
      });
    }),
  );

  // One lookup instead of one per card; createNotification still dedupes (and swallows P2002) on a race.
  const existingKeys = await findExistingDedupeKeys(due.map((item) => item.dedupeKey));
  await Promise.all(due.filter((item) => !existingKeys.has(item.dedupeKey)).map(notifyCardReminder));
};

const findExistingDedupeKeys = async (keys: string[]) => {
  if (!keys.length) return new Set<string>();

  const rows = await db.notification.findMany({
    where: { dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  });

  return new Set(rows.map((row) => row.dedupeKey));
};

// Deadline blocks in personal note pages reuse the card reminder notification.
export const ensureNoteDeadlineNotifications = async ({ userId }: { userId: string }) => {
  const now = new Date();
  const deadlines = await db.noteDeadline.findMany({
    // Largest offset is 2 weeks; deadlines over a day old are not announced late.
    where: { userId, done: false, reminder: { not: "none" }, dueAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: new Date(now.getTime() + 20160 * 60 * 1000) }, page: { deletedAt: null } },
    select: { pageId: true, blockId: true, title: true, dueAt: true, reminder: true, page: { select: { title: true } } },
    take: 200,
  });
  // Read after the mirror: a block converted to a Card meanwhile is skipped even if this request saw its old row.
  const maps = deadlines.length
    ? await db.noteDeadlineTaskMap.findMany({ where: { userId, pageId: { in: [...new Set(deadlines.map(deadline => deadline.pageId))] } }, select: { pageId: true, blockId: true, restoredAt: true } })
    : [];
  const mapped = new Map(maps.map(map => [`${map.pageId}:${map.blockId}`, map.restoredAt]));

  const due = deadlines.flatMap((deadline) => {
    const offsetMinutes = parseInt(deadline.reminder, 10);
    if (Number.isNaN(offsetMinutes)) return [];
    const triggerTime = new Date(deadline.dueAt.getTime() - offsetMinutes * 60 * 1000);
    if (now < triggerTime) return [];
    // One active source: a converted block reminds via its Card; after restore, a time that passed while it was a Card is not replayed.
    const key = `${deadline.pageId}:${deadline.blockId}`;
    if (mapped.has(key)) {
      const restoredAt = mapped.get(key);
      if (!restoredAt || triggerTime < restoredAt) return [];
    }

    return [{ deadline, triggerTime, dedupeKey: `note-reminder:${userId}:${deadline.pageId}:${deadline.blockId}:${deadline.dueAt.getTime()}:${deadline.reminder}` }];
  });
  const existingKeys = await findExistingDedupeKeys(due.map((item) => item.dedupeKey));

  await Promise.all(due.filter((item) => !existingKeys.has(item.dedupeKey)).map(async ({ deadline, triggerTime, dedupeKey }) => {
    await createNotification({
      recipientUserId: userId,
      type: NOTIFICATION_TYPE.CARD_REMINDER,
      title: "Sap den han",
      message: `Hạn "${deadline.title}" trong trang "${deadline.page.title}" sắp đến.`,
      boardTitle: deadline.page.title,
      cardTitle: deadline.title,
      dueDate: deadline.dueAt,
      triggerTime,
      reminderLabel: reminderLabels[deadline.reminder] || "",
      pageId: deadline.pageId,
      dedupeKey,
    });
  }));
};
