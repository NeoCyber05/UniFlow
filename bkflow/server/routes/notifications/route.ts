import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureDueReminderNotifications, ensureNoteDeadlineNotifications } from "@/lib/notifications/reminder-notifications";

const lastEnsureAt = new Map<string, number>();
const ENSURE_MIN_GAP_MS = 25_000;

const ensureReminders = (userId: string) =>
  Promise.all([ensureDueReminderNotifications({ userId }), ensureNoteDeadlineNotifications({ userId })]);

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // First read per user waits (fallback when opening the app); later polls run it in the background so the list returns at once.
    // shortcut: per-process map, fine for a single Node instance; the reminder worker covers delivery otherwise.
    const last = lastEnsureAt.get(userId);
    const now = Date.now();

    if (last === undefined) {
      lastEnsureAt.set(userId, now);
      await ensureReminders(userId);
    } else if (now - last >= ENSURE_MIN_GAP_MS) {
      lastEnsureAt.set(userId, now);
      void ensureReminders(userId).catch((error) =>
        logger.error("[NOTIFICATIONS_ENSURE_ERROR]", error, { route: "/api/notifications", action: "notifications-ensure" }),
      );
    }

    const notifications = await db.notification.findMany({
      where: {
        
        recipientUserId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return Response.json(notifications);
  } catch (error) {
    logger.error("[NOTIFICATIONS_GET_ERROR]", error, {
      route: "/api/notifications",
      action: "notifications-get",
    });

    return new Response("Internal Error", { status: 500 });
  }
}
