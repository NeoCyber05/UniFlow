import { createHash, randomBytes, randomUUID } from "node:crypto";
import webpush from "web-push";

import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { sendChannelMessage, type ChannelMessage, type ExternalChannel } from "@/lib/notifications/channels";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { OPEN_DELIVERY_STATUSES, getReminderTime } from "@/lib/notifications/reminder-deliveries";
import { getCardReminderKey, notifyCardReminder } from "@/lib/notifications/reminder-notifications";

const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [30_000, 120_000];
const PUSH_TTL_SECONDS = 600;
const SEND_TIMEOUT_MS = 10_000;
// Provider answers that mean "rejected for now"; anything else is final or unknown.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export const hashDisplayToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SendResult = { statusCode: number; retryAfterMs?: number };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { deliveryId: string; bindingId: string; displayToken: string };

export const getVapidConfig = () => {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
};

/** Real sender. Never logs endpoint, keys or payload. */
export const sendPush = async (target: PushTarget, payload: PushPayload): Promise<SendResult> => {
  const vapid = getVapidConfig();
  if (!vapid) throw new Error("VAPID_NOT_CONFIGURED");

  try {
    const res = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        TTL: PUSH_TTL_SECONDS,
        timeout: SEND_TIMEOUT_MS,
        urgency: "high",
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      },
    );
    return { statusCode: res.statusCode };
  } catch (error) {
    const e = error as { statusCode?: number; headers?: Record<string, string> };
    // Only an HTTP answer from the provider is a verdict; timeouts and socket errors are rethrown (unknown).
    if (typeof e.statusCode !== "number") throw error;
    const seconds = Number(e.headers?.["retry-after"]);
    return { statusCode: e.statusCode, ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfterMs: seconds * 1000 } : {}) };
  }
};

export type ReminderBatchDeps = {
  db: Pick<typeof db, "reminderDelivery" | "webPushSubscription">;
  send: (target: PushTarget, payload: PushPayload) => Promise<SendResult>;
  sendChannel: (channel: ExternalChannel, endpoint: string, message: ChannelMessage) => Promise<SendResult>;
  notifyInApp: typeof notifyCardReminder;
  newToken: () => string;
  log: (message: string, context: Record<string, unknown>) => void;
};

export const defaultDeps: ReminderBatchDeps = {
  db,
  send: sendPush,
  sendChannel: sendChannelMessage,
  notifyInApp: notifyCardReminder,
  newToken: () => randomBytes(32).toString("base64url"),
  log: (message, context) => logger.info(message, context),
};

type Counts = { claimed: number; accepted: number; cancelled: number; failed: number; unknown: number; retried: number };

/** Một lượt quét: claim bằng CAS, gửi ngoài transaction, kết quả chỉ ghi được khi còn giữ claimToken. */
export const runReminderBatch = async (
  { now, limit = 50 }: { now: Date; limit?: number },
  deps: ReminderBatchDeps = defaultDeps,
): Promise<Counts> => {
  const counts: Counts = { claimed: 0, accepted: 0, cancelled: 0, failed: 0, unknown: 0, retried: 0 };
  const { reminderDelivery: deliveries, webPushSubscription: subscriptions } = deps.db;

  const candidates = await deliveries.findMany({
    where: {
      OR: [
        { status: { in: ["pending", "retry"] }, nextAttemptAt: { lte: now } },
        { status: "sending", leaseUntil: { lt: now } },
      ],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true, status: true },
  });

  for (const candidate of candidates) {
    if (candidate.status === "sending") {
      // Worker died (or hung) after possibly sending: the provider may already have it, so never resend.
      const { count } = await deliveries.updateMany({
        where: { id: candidate.id, status: "sending", leaseUntil: { lt: now } },
        data: { status: "unknown", errorCode: "lease_expired", claimToken: null },
      });
      counts.unknown += count;
      continue;
    }

    const claimToken = randomUUID();
    const displayToken = deps.newToken();
    const claim = await deliveries.updateMany({
      where: { id: candidate.id, status: { in: ["pending", "retry"] }, nextAttemptAt: { lte: now } },
      data: {
        status: "sending",
        claimToken,
        leaseUntil: new Date(now.getTime() + LEASE_MS),
        attempts: { increment: 1 },
        displayTokenHash: hashDisplayToken(displayToken),
      },
    });
    if (claim.count === 0) continue;
    counts.claimed += 1;

    // Chỉ ghi kết quả khi vẫn là chủ claim; worker hết lease không được ghi đè.
    const finish = async (data: Record<string, unknown>) => {
      const { count } = await deliveries.updateMany({
        where: { id: candidate.id, status: "sending", claimToken },
        data: { claimToken: null, leaseUntil: null, ...data },
      });
      return count > 0;
    };

    const delivery = await deliveries.findUnique({
      where: { id: candidate.id },
      include: {
        subscription: true,
        card: {
          select: {
            id: true, title: true, dueDate: true, deadlineOn: true, reminder: true, isCompleted: true, archivedAt: true,
            list: { select: { title: true, archivedAt: true, board: { select: { id: true, title: true, userId: true } } } },
          },
        },
      },
    });
    if (!delivery) continue;

    const at = getReminderTime(delivery.card);
    const stillValid = Boolean(
      at &&
      String(at.getTime()) === delivery.generation &&
      delivery.card.list.board.userId === delivery.recipientUserId &&
      delivery.subscription.active &&
      delivery.subscription.userId === delivery.recipientUserId,
    );

    if (!stillValid || !at) {
      if (await finish({ status: "cancelled" })) counts.cancelled += 1;
      continue;
    }

    if (now.getTime() > delivery.expiresAt.getTime()) {
      if (await finish({ status: "failed", errorCode: "expired" })) counts.failed += 1;
      continue;
    }

    const dueDate = getTaskDeadlineAt({
      dueDate: delivery.card.dueDate?.toISOString() ?? null,
      deadlineOn: delivery.card.deadlineOn?.toISOString().slice(0, 10) ?? null,
    })!;

    // Cùng dedupeKey với GET /api/notifications nên hai đường không tạo hai thông báo.
    await deps.notifyInApp({
      card: delivery.card,
      recipientUserId: delivery.recipientUserId,
      triggerTime: at,
      dueDate,
      dedupeKey: getCardReminderKey({ recipientUserId: delivery.recipientUserId, cardId: delivery.cardId, generation: delivery.generation }),
    });

    const { channel = "webpush", endpoint } = delivery.subscription;
    const board = delivery.card.list.board;
    let result: SendResult;
    try {
      result = channel === "webpush"
        ? await deps.send(
          { endpoint, p256dh: delivery.subscription.p256dh, auth: delivery.subscription.auth },
          { deliveryId: delivery.id, bindingId: delivery.subscription.bindingId, displayToken },
        )
        : await deps.sendChannel(channel as ExternalChannel, endpoint, {
          title: delivery.card.title,
          dueAt: dueDate,
          boardTitle: board.title,
          listTitle: delivery.card.list.title,
          url: `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/board/${board.id}?cardId=${delivery.cardId}`,
        });
    } catch {
      if (await finish({ status: "unknown", errorCode: "send_error" })) counts.unknown += 1;
      deps.log("reminder.unknown", { deliveryId: delivery.id });
      continue;
    }

    const { statusCode } = result;
    const attempts = delivery.attempts;

    if (statusCode >= 200 && statusCode < 300) {
      if (await finish({ status: "accepted", acceptedAt: now, errorCode: null })) counts.accepted += 1;
    } else if (statusCode === 404 || statusCode === 410) {
      if (await finish({ status: "failed", errorCode: `http_${statusCode}` })) counts.failed += 1;
      await subscriptions.update({ where: { id: delivery.subscriptionId }, data: { active: false } });
      await deliveries.updateMany({
        where: { subscriptionId: delivery.subscriptionId, status: { in: OPEN_DELIVERY_STATUSES } },
        data: { status: "cancelled" },
      });
    } else if (RETRYABLE.has(statusCode) && attempts < MAX_ATTEMPTS) {
      const nextAttemptAt = new Date(now.getTime() + (result.retryAfterMs ?? BACKOFF_MS[attempts - 1]));
      if (nextAttemptAt.getTime() > delivery.expiresAt.getTime()) {
        if (await finish({ status: "failed", errorCode: "expired" })) counts.failed += 1;
      } else if (await finish({ status: "retry", nextAttemptAt, errorCode: `http_${statusCode}` })) {
        counts.retried += 1;
      }
    } else if (await finish({ status: "failed", errorCode: `http_${statusCode}` })) {
      counts.failed += 1;
    }

    deps.log("reminder.sent", { deliveryId: delivery.id, statusCode, attempts });
  }

  return counts;
};
