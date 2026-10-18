import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { OPEN_DELIVERY_STATUSES, syncSubscriptionReminders } from "@/lib/notifications/reminder-deliveries";

type SubscriptionDb = Pick<typeof db, "webPushSubscription" | "reminderDelivery" | "$transaction">;
type Deps = { syncSubscriptionReminders: typeof syncSubscriptionReminders };

// shortcut: provider allowlist from public docs (Chrome/FCM, Firefox, Edge/WNS, Safari); confirm Edge's real endpoint host in the Task 9 spike.
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];
const MAX_ENDPOINT_LENGTH = 2048;

const keyLength = (value: unknown, bytes: number) =>
  typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value) && Buffer.from(value, "base64url").length === bytes;

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };

export const parsePushSubscriptionInput = (input: unknown): PushSubscriptionInput | { error: string } => {
  const { endpoint, keys } = (input ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return { error: "Endpoint không hợp lệ." };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { error: "Endpoint không hợp lệ." };
  }

  const hostAllowed = PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hostAllowed) {
    return { error: "Endpoint không được hỗ trợ." };
  }

  if (!keyLength(keys?.p256dh, 65) || !keyLength(keys?.auth, 16)) {
    return { error: "Khóa đăng ký không hợp lệ." };
  }

  return { endpoint, p256dh: keys!.p256dh as string, auth: keys!.auth as string };
};

type UpsertResult = { data: { subscriptionId: string; bindingId: string } } | { error: string };

export const upsertPushSubscription = async (
  userId: string,
  input: unknown,
  database: SubscriptionDb = db,
  deps: Deps = { syncSubscriptionReminders },
  now: Date = new Date(),
  retry = true,
): Promise<UpsertResult> => {
  const parsed = parsePushSubscriptionInput(input);
  if ("error" in parsed) return parsed;

  try {
    return await database.$transaction(async (tx) => {
      const existing = await tx.webPushSubscription.findUnique({ where: { endpoint: parsed.endpoint } });
      let sub;

      if (existing && existing.userId === userId && existing.active) {
        sub = existing.p256dh === parsed.p256dh && existing.auth === parsed.auth
          ? existing
          : await tx.webPushSubscription.update({
            where: { id: existing.id },
            data: { p256dh: parsed.p256dh, auth: parsed.auth },
          });
      } else if (existing) {
        // Another account or a revoked device: start a new binding and drop the old account's queued sends.
        await tx.reminderDelivery.updateMany({
          where: { subscriptionId: existing.id, status: { in: OPEN_DELIVERY_STATUSES } },
          data: { status: "cancelled" },
        });
        sub = await tx.webPushSubscription.update({
          where: { id: existing.id },
          data: { userId, p256dh: parsed.p256dh, auth: parsed.auth, bindingId: randomUUID(), active: true },
        });
      } else {
        sub = await tx.webPushSubscription.create({
          data: { userId, endpoint: parsed.endpoint, p256dh: parsed.p256dh, auth: parsed.auth, bindingId: randomUUID() },
        });
      }

      await deps.syncSubscriptionReminders(tx, { subscriptionId: sub.id, now });
      return { data: { subscriptionId: sub.id, bindingId: sub.bindingId } };
    });
  } catch (error) {
    // Two tabs registering the same endpoint at once: the loser retries and finds the winner's row.
    if (retry && (error as { code?: string }).code === "P2002") {
      return upsertPushSubscription(userId, input, database, deps, now, false);
    }
    throw error;
  }
};

/** Returns false (without effect) when the subscription is not this user's. */
export const revokePushSubscription = async (
  userId: string,
  subscriptionId: string,
  database: SubscriptionDb = db,
): Promise<boolean> =>
  database.$transaction(async (tx) => {
    const sub = await tx.webPushSubscription.findFirst({ where: { id: subscriptionId, userId } });
    if (!sub) return false;

    await tx.webPushSubscription.update({ where: { id: sub.id }, data: { active: false } });
    await tx.reminderDelivery.updateMany({
      where: { subscriptionId: sub.id, status: { in: OPEN_DELIVERY_STATUSES } },
      data: { status: "cancelled" },
    });
    return true;
  });

export const getPushSubscriptionStatus = async (
  userId: string,
  subscriptionId: string,
  database: SubscriptionDb = db,
): Promise<{ active: false } | { active: true; bindingId: string }> => {
  const sub = await database.webPushSubscription.findFirst({ where: { id: subscriptionId, userId } });
  return sub?.active ? { active: true, bindingId: sub.bindingId } : { active: false };
};
