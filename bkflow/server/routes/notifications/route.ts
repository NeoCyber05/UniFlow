import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureDueReminderNotifications } from "@/lib/notifications/reminder-notifications";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await ensureDueReminderNotifications({ userId });

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
