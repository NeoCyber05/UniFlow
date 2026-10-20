import { createHmac, timingSafeEqual } from "node:crypto";

import type { SendResult } from "@/lib/notifications/push-delivery";

// Kênh nhắc ngoài app. Mỗi kênh là một dòng WebPushSubscription (channel != "webpush") nên dùng lại nguyên
// pipeline ReminderDelivery: claim, retry, hủy khi đổi hạn, tắt kênh khi provider trả 404/410.
export const WEBHOOK_CHANNELS = ["slack", "teams", "discord"] as const;
export type WebhookChannel = (typeof WEBHOOK_CHANNELS)[number];
export type ExternalChannel = WebhookChannel | "telegram";

export type ChannelMessage = { title: string; dueAt: Date; boardTitle: string; listTitle: string; url: string };

const SEND_TIMEOUT_MS = 10_000;
const MAX_URL_LENGTH = 2048;

// SSRF: server chỉ POST tới đúng host của từng nhà cung cấp.
const HOSTS: Record<WebhookChannel, { hosts: string[]; path?: RegExp }> = {
  slack: { hosts: ["hooks.slack.com"], path: /^\/services\// },
  discord: { hosts: ["discord.com", "discordapp.com"], path: /^\/api\/webhooks\// },
  // Incoming Webhook cũ (webhook.office.com) và Workflows (Power Automate / Logic Apps).
  teams: { hosts: ["webhook.office.com", "logic.azure.com", "powerplatform.com", "powerautomate.com"] },
};

const hostMatches = (hostname: string, host: string) => hostname === host || hostname.endsWith(`.${host}`);

export const isWebhookChannel = (value: unknown): value is WebhookChannel =>
  typeof value === "string" && (WEBHOOK_CHANNELS as readonly string[]).includes(value);

export const parseWebhookUrl = (channel: WebhookChannel, value: unknown): { url: string } | { error: string } => {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return { error: "Webhook URL không hợp lệ." };
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { error: "Webhook URL không hợp lệ." };
  }
  const rule = HOSTS[channel];
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    !rule.hosts.some((host) => hostMatches(url.hostname, host)) ||
    (rule.path && !rule.path.test(url.pathname))
  ) {
    return { error: "URL này không phải webhook của ứng dụng đã chọn." };
  }
  return { url: url.toString() };
};

const formatDue = (date: Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  }).format(date);

export const formatChannelText = (m: ChannelMessage) =>
  `⏰ Sắp đến hạn: ${m.title}\nHạn: ${formatDue(m.dueAt)} · ${m.boardTitle} / ${m.listTitle}\n${m.url}`;

const bodyFor = (channel: ExternalChannel, text: string, chatId?: string) => {
  if (channel === "slack") return { text };
  if (channel === "discord") return { content: text, allowed_mentions: { parse: [] } };
  if (channel === "telegram") return { chat_id: chatId, text, disable_web_page_preview: true };
  // Teams: Adaptive Card chạy được với cả Incoming Webhook cũ lẫn Workflows.
  return {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: text.split("\n").map((line, i) => ({ type: "TextBlock", text: line, wrap: true, ...(i === 0 ? { weight: "Bolder" } : {}) })),
      },
    }],
  };
};

const telegramApi = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

/** endpoint: webhook URL, hoặc "telegram:<chatId>". Không log endpoint (là bí mật). */
export const sendChannelText = async (channel: ExternalChannel, endpoint: string, text: string): Promise<SendResult> => {
  const telegram = channel === "telegram";
  if (telegram && !process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_NOT_CONFIGURED");
  const res = await fetch(telegram ? telegramApi("sendMessage") : endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bodyFor(channel, text, telegram ? endpoint.slice("telegram:".length) : undefined)),
    redirect: "manual",
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const seconds = Number(res.headers.get("retry-after"));
  // Telegram 403 = người dùng đã chặn bot: coi như kênh bị gỡ (410) để pipeline tắt kênh.
  const statusCode = telegram && res.status === 403 ? 410 : res.status;
  return { statusCode, ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfterMs: seconds * 1000 } : {}) };
};

export const sendChannelMessage = (channel: ExternalChannel, endpoint: string, message: ChannelMessage) =>
  sendChannelText(channel, endpoint, formatChannelText(message));

/** Che phần bí mật của webhook khi trả về client. */
export const maskEndpoint = (channel: string, endpoint: string) => {
  if (channel === "telegram") return "Telegram";
  try {
    const url = new URL(endpoint);
    return `${url.hostname} · …${url.pathname.slice(-4)}`;
  } catch {
    return channel;
  }
};

// Liên kết Telegram: t.me/<bot>?start=<token>; token = uuid(16B) + hạn(4B) + HMAC(8B), base64url 38 ký tự (giới hạn 64).
const LINK_TTL_S = 15 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linkMac = (payload: Buffer, secret: string) => createHmac("sha256", secret).update(payload).digest().subarray(0, 8);

export const createTelegramLinkToken = (userId: string, secret: string, now = new Date()) => {
  if (!UUID_RE.test(userId)) throw new Error("userId must be a uuid");
  const payload = Buffer.alloc(20);
  Buffer.from(userId.replace(/-/g, ""), "hex").copy(payload);
  payload.writeUInt32BE(Math.floor(now.getTime() / 1000) + LINK_TTL_S, 16);
  return Buffer.concat([payload, linkMac(payload, secret)]).toString("base64url");
};

export const verifyTelegramLinkToken = (token: string, secret: string, now = new Date()): string | null => {
  const raw = Buffer.from(token, "base64url");
  if (raw.length !== 28) return null;
  const payload = raw.subarray(0, 20);
  if (!timingSafeEqual(raw.subarray(20), linkMac(payload, secret))) return null;
  if (payload.readUInt32BE(16) < now.getTime() / 1000) return null;
  const hex = payload.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const getTelegramConfig = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  return token && username && secret ? { username, secret } : null;
};
