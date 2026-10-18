import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const { notificationId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const read = Boolean(body.read);
    const notification = await db.notification.findFirst({
      where: {
        id: notificationId,
        recipientUserId: userId,
      },
      select: {
        id: true,
      },
    });

    if (!notification) {
      return new Response("Not Found", { status: 404 });
    }

    const updatedNotification = await db.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        readAt: read ? new Date() : null,
      },
    });

    return Response.json(updatedNotification);
  } catch (error) {
    logger.error("[NOTIFICATION_PATCH_ERROR]", error, {
      route: "/api/notifications/[notificationId]",
      action: "notification-patch",
    });

    return new Response("Internal Error", { status: 500 });
  }
}
