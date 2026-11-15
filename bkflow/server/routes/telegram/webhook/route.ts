import { timingSafeEqual } from "node:crypto";

import { answerTelegramMessage } from "@/lib/ai/assistant/telegram-chat";
import { ASSISTANT_LIMITS, getAssistantApiKey } from "@/lib/ai/assistant/config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getTelegramConfig, sendChannelText, verifyTelegramLinkToken } from "@/lib/notifications/channels";
import { saveSubscription } from "@/lib/notifications/push-subscriptions";

type Update = { message?: { text?: string; chat?: { id?: number; type?: string } } };

const sameSecret = (a: string | null, b: string) =>
  a !== null && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// shortcut: chặn chat gửi dồn trong 1 process; chạy nhiều instance thì cần khóa dùng chung (DB/Redis).
const busyChats = new Set<string>();

/** Tin nhắn thường từ chat đã liên kết → trợ lý AI (chỉ đọc). Chạy nền để trả 200 ngay cho Telegram. */
const replyWithAssistant = async (endpoint: string, text: string) => {
  if (busyChats.has(endpoint)) return;
  busyChats.add(endpoint);
  try {
    const sub = await db.webPushSubscription.findUnique({ where: { endpoint }, select: { userId: true, active: true } });
    if (!sub?.active) {
      await sendChannelText("telegram", endpoint, "Chat này chưa liên kết UniFlow. Mở Cài đặt > Thông báo trong UniFlow để kết nối.");
      return;
    }
    if (!getAssistantApiKey()) {
      await sendChannelText("telegram", endpoint, "Máy chủ chưa cấu hình Trợ lý AI.");
      return;
    }
    if (text.length > ASSISTANT_LIMITS.messageMaxLength) {
      await sendChannelText("telegram", endpoint, `Tin nhắn quá dài (tối đa ${ASSISTANT_LIMITS.messageMaxLength} ký tự).`);
      return;
    }
    await sendChannelText("telegram", endpoint, await answerTelegramMessage(sub.userId, text));
  } catch (error) {
    logger.error("[TELEGRAM_ASSISTANT_ERROR]", error, { route: "/api/telegram/webhook" });
    await sendChannelText("telegram", endpoint, "Trợ lý AI đang gặp sự cố. Vui lòng thử lại sau.").catch(() => undefined);
  } finally {
    busyChats.delete(endpoint);
  }
};

/** Bot Telegram gọi vào đây (public, xác thực bằng secret_token đặt lúc setWebhook). "/start <token>" để liên kết, tin khác hỏi trợ lý AI. */
export async function POST(req: Request) {
  const config = getTelegramConfig();
  if (!config) return new Response("Not Found", { status: 404 });
  if (!sameSecret(req.headers.get("x-telegram-bot-api-secret-token"), config.secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as Update | null;
  const chat = update?.message?.chat;
  const text = update?.message?.text?.trim();
  // Luôn 200 để Telegram không gửi lại update; chỉ nhận chat riêng.
  if (!text || chat?.type !== "private" || typeof chat.id !== "number") return new Response(null, { status: 200 });

  const endpoint = `telegram:${chat.id}`;
  const match = text.match(/^\/start\s+([A-Za-z0-9_-]+)$/);
  if (!match) {
    if (!text.startsWith("/")) void replyWithAssistant(endpoint, text);
    return new Response(null, { status: 200 });
  }

  const userId = verifyTelegramLinkToken(match[1], config.secret);
  try {
    if (!userId) {
      await sendChannelText("telegram", endpoint, "Liên kết đã hết hạn. Mở lại Cài đặt > Thông báo trong UniFlow để lấy link mới.");
      return new Response(null, { status: 200 });
    }
    await saveSubscription(userId, { channel: "telegram", endpoint, p256dh: "", auth: "" });
    await sendChannelText("telegram", endpoint, "✅ Đã kết nối UniFlow. Nhắc hạn nộp sẽ được gửi vào đây. Bạn cũng có thể nhắn để hỏi trợ lý AI, ví dụ: \"hôm nay mình cần làm gì?\"");
  } catch (error) {
    logger.error("[TELEGRAM_WEBHOOK_ERROR]", error, { route: "/api/telegram/webhook" });
  }
  return new Response(null, { status: 200 });
}
