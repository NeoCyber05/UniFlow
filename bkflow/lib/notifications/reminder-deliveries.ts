import type { Prisma } from "@prisma/client";

import { deadlineWhere, getTaskReminderAt } from "@/lib/cards/task-deadline";

/** Transaction (or fake) the sync runs in; network sends never happen here. */
export type ReminderTx = Pick<Prisma.TransactionClient, "card" | "webPushSubscription" | "reminderDelivery">;

export const REMINDER_TTL_MS = 10 * 60_000;
export const OPEN_DELIVERY_STATUSES = ["pending", "retry", "sending"];

export type ReminderCard = {
  dueDate: Date | null;
  deadlineOn: Date | null;
  reminder: string | null;
  isCompleted: boolean;
  archivedAt: Date | null;
  list: { archivedAt: Date | null };
};

/** Mốc nhắc của task còn hoạt động có hạn + offset hợp lệ; không xét mốc đã qua. */
export const getReminderTime = (card: ReminderCard): Date | null => {
  if (card.archivedAt || card.list.archivedAt || card.isCompleted) return null;
  if (!card.reminder || !/^\d+$/.test(card.reminder)) return null;

  return getTaskReminderAt(
    { dueDate: card.dueDate?.toISOString() ?? null, deadlineOn: card.deadlineOn?.toISOString().slice(0, 10) ?? null },
    parseInt(card.reminder, 10),
  );
};

/**
 * Phiên nhắc hiện hành. generation = mốc nhắc (ms): đổi hạn/offset/trạng thái đủ điều kiện thì đổi,
 * sửa tên hoặc dời lịch làm thì giữ nguyên.
 */
export const getCardReminder = (card: ReminderCard, now: Date): { at: Date; generation: string } | null => {
  const at = getReminderTime(card);
  return at && at.getTime() > now.getTime() ? { at, generation: String(at.getTime()) } : null;
};

const select = {
  id: true,
  dueDate: true,
  deadlineOn: true,
  reminder: true,
  isCompleted: true,
  archivedAt: true,
  reminderGeneration: true,
  updatedAt: true,
  list: { select: { archivedAt: true, board: { select: { userId: true } } } },
} as const;

/** Hủy phiên cũ, lập phiên tương lai cho mọi thiết bị đang bật; gọi trong cùng transaction với thay đổi task. */
export const syncCardReminder = async (tx: ReminderTx, { cardId, now }: { cardId: string; now: Date }) => {
  const card = await tx.card.findUnique({ where: { id: cardId }, select });
  if (!card) return;

  const next = getCardReminder(card, now);
  const generation = next?.generation ?? null;

  if ((card.reminderGeneration ?? null) !== generation) {
    // updatedAt giữ nguyên: đây không phải thay đổi nội dung, không được làm client mất revision.
    await tx.card.update({ where: { id: cardId }, data: { reminderGeneration: generation, updatedAt: card.updatedAt } });
  }

  await tx.reminderDelivery.updateMany({
    where: { cardId, status: { in: OPEN_DELIVERY_STATUSES }, ...(next ? { generation: { not: next.generation } } : {}) },
    data: { status: "cancelled" },
  });

  if (!next) return;

  const recipientUserId = card.list.board.userId;
  const subs = await tx.webPushSubscription.findMany({ where: { userId: recipientUserId, active: true }, select: { id: true } });
  if (subs.length === 0) return;

  await tx.reminderDelivery.createMany({
    data: subs.map((sub) => ({
      cardId,
      recipientUserId,
      subscriptionId: sub.id,
      generation: next.generation,
      dueAt: next.at,
      nextAttemptAt: next.at,
      expiresAt: new Date(next.at.getTime() + REMINDER_TTL_MS),
    })),
    skipDuplicates: true,
  });

  // Mở lại task về đúng mốc cũ: hồi sinh dòng đã hủy của phiên này, không đụng dòng accepted/failed.
  await tx.reminderDelivery.updateMany({
    where: { cardId, generation: next.generation, status: "cancelled", recipientUserId, subscription: { active: true, userId: recipientUserId } },
    data: { status: "pending", attempts: 0, nextAttemptAt: next.at, claimToken: null, leaseUntil: null, errorCode: null },
  });
};

export const syncCardReminders = async (tx: ReminderTx, { cardIds, now }: { cardIds: string[]; now: Date }) => {
  for (const cardId of new Set(cardIds)) await syncCardReminder(tx, { cardId, now });
};

/** Thiết bị mới (hoặc đổi chủ) chỉ nhận các nhắc tương lai, không phát bù hạn cũ. */
export const syncSubscriptionReminders = async (tx: ReminderTx, { subscriptionId, now }: { subscriptionId: string; now: Date }) => {
  const sub = await tx.webPushSubscription.findUnique({ where: { id: subscriptionId } });
  if (!sub?.active) return;

  const cards = await tx.card.findMany({
    where: {
      archivedAt: null,
      isCompleted: false,
      reminder: { not: null, notIn: ["none"] },
      ...deadlineWhere({ gte: now }),
      list: { archivedAt: null, board: { userId: sub.userId } },
    },
    select,
    take: 1000, // shortcut: 1000 nhắc tương lai đầu tiên mỗi thiết bị; đủ cho một sinh viên, tăng nếu có người vượt
  });

  await syncCardReminders(tx, { cardIds: cards.filter((card) => getCardReminder(card, now)).map((card) => card.id), now });
};
