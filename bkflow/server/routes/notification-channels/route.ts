import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createTelegramLinkToken,
  getTelegramConfig,
  isWebhookChannel,
  maskEndpoint,
  parseWebhookUrl,
  sendChannelText,
} from "@/lib/notifications/channels";
import { revokePushSubscription, saveSubscription } from "@/lib/notifications/push-subscriptions";

const readJson = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

/** Kênh ngoài đang bật (đã che URL) + link kết nối Telegram nếu server có cấu hình bot. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let rows;
  try {
    rows = await db.webPushSubscription.findMany({
      where: { userId, active: true, channel: { not: "webpush" } },
      select: { id: true, channel: true, endpoint: true },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    // P2022: chưa chạy prisma/sql/20261021_notification_channels.sql (thiếu cột "channel").
    logger.error("[NOTIFICATION_CHANNEL_GET_ERROR]", error, { route: "/api/notification-channels" });
    return new Response("Internal Error", { status: 500 });
  }
  const telegram = getTelegramConfig();

  return Response.json({
    channels: rows.map((row) => ({ id: row.id, channel: row.channel, label: maskEndpoint(row.channel, row.endpoint) })),
    telegramLink: telegram ? `https://t.me/${telegram.username}?start=${createTelegramLinkToken(userId, telegram.secret)}` : null,
  });
}

/** Thêm webhook Slack/Teams/Discord: gửi thử trước, chỉ lưu khi nhà cung cấp nhận. */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await readJson(req)) as { channel?: unknown; url?: unknown } | null;
  if (!isWebhookChannel(body?.channel)) return Response.json({ error: "Kênh không được hỗ trợ." }, { status: 400 });
  const parsed = parseWebhookUrl(body.channel, body.url);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    const test = await sendChannelText(body.channel, parsed.url, "✅ UniFlow đã kết nối. Nhắc hạn nộp sẽ được gửi vào đây.");
    if (test.statusCode < 200 || test.statusCode >= 300) {
      return Response.json({ error: `Webhook từ chối tin thử (HTTP ${test.statusCode}). Kiểm tra lại URL.` }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Không gửi được tin thử tới webhook." }, { status: 400 });
  }

  try {
    const result = await saveSubscription(userId, { channel: body.channel, endpoint: parsed.url, p256dh: "", auth: "" });
    if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ id: result.data.subscriptionId });
  } catch (error) {
    logger.error("[NOTIFICATION_CHANNEL_POST_ERROR]", error, { route: "/api/notification-channels" });
    return new Response("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await readJson(req)) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return new Response("Bad Request", { status: 400 });

  try {
    await revokePushSubscription(userId, body.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error("[NOTIFICATION_CHANNEL_DELETE_ERROR]", error, { route: "/api/notification-channels" });
    return new Response("Internal Error", { status: 500 });
  }
}
