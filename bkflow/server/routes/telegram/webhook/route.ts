import { timingSafeEqual } from "node:crypto";

import { logger } from "@/lib/logger";
import { getTelegramConfig, sendChannelText, verifyTelegramLinkToken } from "@/lib/notifications/channels";
import { saveSubscription } from "@/lib/notifications/push-subscriptions";

type Update = { message?: { text?: string; chat?: { id?: number; type?: string } } };

const sameSecret = (a: string | null, b: string) =>
  a !== null && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Bot Telegram gọi vào đây (public, xác thực bằng secret_token đặt lúc setWebhook). Chỉ xử lý "/start <token>". */
export async function POST(req: Request) {
  const config = getTelegramConfig();
  if (!config) return new Response("Not Found", { status: 404 });
  if (!sameSecret(req.headers.get("x-telegram-bot-api-secret-token"), config.secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as Update | null;
  const chat = update?.message?.chat;
  const match = update?.message?.text?.match(/^\/start\s+([A-Za-z0-9_-]+)$/);
  // Luôn 200 để Telegram không gửi lại update; chỉ nhận chat riêng.
  if (!match || chat?.type !== "private" || typeof chat.id !== "number") return new Response(null, { status: 200 });

  const endpoint = `telegram:${chat.id}`;
  const userId = verifyTelegramLinkToken(match[1], config.secret);
  try {
    if (!userId) {
      await sendChannelText("telegram", endpoint, "Liên kết đã hết hạn. Mở lại Cài đặt > Thông báo trong UniFlow để lấy link mới.");
      return new Response(null, { status: 200 });
    }
    await saveSubscription(userId, { channel: "telegram", endpoint, p256dh: "", auth: "" });
    await sendChannelText("telegram", endpoint, "✅ Đã kết nối UniFlow. Nhắc hạn nộp sẽ được gửi vào đây.");
  } catch (error) {
    logger.error("[TELEGRAM_WEBHOOK_ERROR]", error, { route: "/api/telegram/webhook" });
  }
  return new Response(null, { status: 200 });
}
