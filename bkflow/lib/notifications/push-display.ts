import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashDisplayToken } from "@/lib/notifications/push-delivery";
import { getReminderTime } from "@/lib/notifications/reminder-deliveries";

type DisplayDb = Pick<typeof db, "reminderDelivery">;

const MAX_BODY_BYTES = 1024;
// A push is shown only once the provider took it (accepted) or the worker could not tell (unknown); sending covers the race with the worker.
const DISPLAYABLE = ["sending", "accepted", "unknown"];

const DisplayBody = z.object({
  deliveryId: z.uuid(),
  displayToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

const cardSelect = {
  id: true, dueDate: true, deadlineOn: true, reminder: true, isCompleted: true, archivedAt: true,
  list: { select: { archivedAt: true, board: { select: { id: true, userId: true } } } },
} as const;

/** Service worker asks before showing anything: capability token + delivery must still be valid. Never returns task content. */
export const verifyPushDisplay = async (input: unknown, database: DisplayDb = db, now = new Date()): Promise<{ allowed: boolean }> => {
  const parsed = DisplayBody.safeParse(input);
  if (!parsed.success) return { allowed: false };

  const delivery = await database.reminderDelivery.findUnique({
    where: { id: parsed.data.deliveryId },
    include: { subscription: true, card: { select: cardSelect } },
  });
  if (!delivery?.displayTokenHash || !DISPLAYABLE.includes(delivery.status)) return { allowed: false };

  const given = Buffer.from(hashDisplayToken(parsed.data.displayToken));
  const stored = Buffer.from(delivery.displayTokenHash);
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) return { allowed: false };

  const at = getReminderTime(delivery.card);
  const allowed = now.getTime() <= delivery.expiresAt.getTime() &&
    at !== null && String(at.getTime()) === delivery.generation &&
    delivery.card.list.board.userId === delivery.recipientUserId &&
    delivery.subscription.active && delivery.subscription.userId === delivery.recipientUserId;

  return { allowed };
};

/** shortcut: in-memory fixed window per process; use a shared store if the API runs on several instances. */
export const createRateLimiter = ({ limit, windowMs }: { limit: number; windowMs: number }) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (key: string, now: number) => {
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    const hit = hits.get(key);
    if (!hit || hit.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    hit.count += 1;
    return hit.count <= limit;
  };
};

export type DisplayDeps = { db: DisplayDb; now: () => Date; limiter: (key: string, now: number) => boolean };

export const defaultDisplayDeps: DisplayDeps = {
  db,
  now: () => new Date(),
  limiter: createRateLimiter({ limit: 30, windowMs: 60_000 }),
};

export const handleDisplayRequest = async (req: Request, deps: DisplayDeps = defaultDisplayDeps): Promise<Response> => {
  const now = deps.now();
  // shortcut: trusts the first x-forwarded-for hop set by Railway's proxy; spoofable if exposed without a proxy.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!deps.limiter(ip, now.getTime())) return new Response("Too Many Requests", { status: 429 });

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return new Response("Bad Request", { status: 400 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  return Response.json(await verifyPushDisplay(body, deps.db, now));
};

/** Where a notification click should land; null when the task is gone, archived or not the recipient's. */
export const resolveDeliveryTarget = async (
  userId: string,
  deliveryId: string,
  database: DisplayDb = db,
): Promise<{ boardId: string; cardId: string } | null> => {
  if (!z.uuid().safeParse(deliveryId).success) return null;

  const delivery = await database.reminderDelivery.findFirst({
    where: { id: deliveryId, recipientUserId: userId },
    include: { card: { select: cardSelect } },
  });
  const card = delivery?.card;
  if (!card || card.archivedAt || card.list.archivedAt || card.list.board.userId !== userId) return null;

  return { boardId: card.list.board.id, cardId: card.id };
};
