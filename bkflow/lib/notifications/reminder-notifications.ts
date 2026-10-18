import { NOTIFICATION_TYPE } from "@prisma/client";

import { createNotification } from "@/lib/notifications/create-notification";
import { db } from "@/lib/db";

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
      dueDate: {
        not: null,
      },
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
      reminder: true,
      reminderSetAt: true,
      list: {
        select: {
          title: true,
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

  await Promise.all(
    cards.map(async (card) => {
      if (!card.dueDate || !card.reminder) {
        return;
      }

      const offsetMinutes = parseInt(card.reminder, 10);
      if (Number.isNaN(offsetMinutes)) {
        return;
      }

      const dueDate = new Date(card.dueDate);
      const triggerTime = new Date(dueDate.getTime() - offsetMinutes * 60 * 1000);

      if (
        card.reminderSetAt &&
        triggerTime.getTime() < new Date(card.reminderSetAt).getTime()
      ) {
        return;
      }

      if (now < triggerTime.getTime()) {
        return;
      }

      await createNotification({
        recipientUserId: userId,
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
        reminderLabel: reminderLabels[card.reminder] || "",
        dedupeKey: getReminderDedupeKey({
          recipientUserId: userId,
          cardId: card.id,
          reminder: card.reminder,
          reminderSetAt: card.reminderSetAt,
        }),
      });
    }),
  );
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

  await Promise.all(deadlines.map(async (deadline) => {
    const offsetMinutes = parseInt(deadline.reminder, 10);
    if (Number.isNaN(offsetMinutes)) return;
    const triggerTime = new Date(deadline.dueAt.getTime() - offsetMinutes * 60 * 1000);
    if (now < triggerTime) return;

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
      dedupeKey: `note-reminder:${userId}:${deadline.pageId}:${deadline.blockId}:${deadline.dueAt.getTime()}:${deadline.reminder}`,
    });
  }));
};
