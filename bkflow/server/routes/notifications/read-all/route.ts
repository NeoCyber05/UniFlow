import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function PATCH() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await db.notification.updateMany({
      where: {
        recipientUserId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    logger.error("[NOTIFICATIONS_READ_ALL_ERROR]", error, {
      route: "/api/notifications/read-all",
      action: "notifications-read-all",
    });

    return new Response("Internal Error", { status: 500 });
  }
}
