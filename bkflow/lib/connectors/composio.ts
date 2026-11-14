// Kết nối ứng dụng ngoài (Gmail, Slack) cho Trợ lý AI qua Composio Tool Router.
// Chuyển thể từ OpenMausBot (Apache-2.0, github.com/milind-soni/OpenMausBot):
// server/composio.ts, composio-session.ts, connected-reads.ts, connector-tools-list.ts.
// Khác bản gốc: mỗi người dùng UniFlow là một Composio user riêng, chỉ một tài khoản mỗi app, chỉ công cụ đọc.
import "server-only";

import { z } from "zod";

export const CONNECTOR_APPS = ["gmail", "slack"] as const;
export type ConnectorApp = (typeof CONNECTOR_APPS)[number];

export const isConnectorApp = (value: unknown): value is ConnectorApp =>
  typeof value === "string" && (CONNECTOR_APPS as readonly string[]).includes(value);

/** Chỉ công cụ ĐỌC: nội dung email/Slack là dữ liệu không tin cậy nên agent không được gửi hay xóa gì ở app ngoài. */
export const APP_READ_TOOLS = {
  gmailList: "GMAIL_FETCH_EMAILS",
  gmailMessage: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",
  slackSearch: "SLACK_SEARCH_MESSAGES",
} as const;
const ALLOWED_TOOLS = new Set<string>(Object.values(APP_READ_TOOLS));

const API = "https://backend.composio.dev/api/v3.1";
const MULTI_EXECUTE = "COMPOSIO_MULTI_EXECUTE_TOOL";
const CALL_ID = "uf-call";
const MAX_ANSWER_BYTES = 5 * 1024 * 1024;

const apiKey = () => process.env.COMPOSIO_API_KEY?.trim() || null;
export const composioConfigured = () => apiKey() !== null;

const headers = (json = false) => {
  const result = new Headers({ "x-api-key": apiKey() ?? "" });
  if (json) result.set("content-type", "application/json");
  return result;
};

const responseError = async (res: Response, fallback: string) => {
  const raw = await res.text().catch(() => "");
  try {
    const body = JSON.parse(raw);
    return String(body?.message ?? body?.error?.message ?? body?.error ?? fallback);
  } catch {
    return raw.trim().slice(0, 300) || fallback;
  }
};

/** Link OAuth và MCP phải nằm trên host của Composio: không chuyển người dùng hay API key tới host lạ. */
export const trustedComposioUrl = (value: string | undefined): string => {
  if (!value) throw new Error("Composio không trả về liên kết.");
  const url = new URL(value);
  if (url.protocol !== "https:" || (url.hostname !== "composio.dev" && !url.hostname.endsWith(".composio.dev"))) {
    throw new Error("Composio trả về liên kết không tin cậy.");
  }
  return url.toString();
};

// ---------- Session ----------

const sessionSchema = z.object({ session_id: z.string().min(1), mcp: z.object({ url: z.string().min(1) }) });
type Session = { id: string; mcpUrl: string };

// shortcut: cache trong một process; restart thì tạo Session mới (kết nối thuộc về user_id nên không mất). Lưu vào DB khi cần giảm số Session.
const sessions = new Map<string, Promise<Session>>();

const createSession = async (userId: string): Promise<Session> => {
  const res = await fetch(`${API}/tool_router/session`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      // userId lấy từ phiên đăng nhập ở server, không bao giờ từ client.
      user_id: `uniflow_${userId}`,
      manage_connections: { enable: true, enable_wait_for_connections: true, enable_connection_removal: true },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(await responseError(res, `Composio session: HTTP ${res.status}`));
  const body = sessionSchema.parse(await res.json());
  return { id: body.session_id, mcpUrl: trustedComposioUrl(body.mcp.url) };
};

const getSession = (userId: string): Promise<Session> => {
  if (!apiKey()) return Promise.reject(new Error("Máy chủ chưa cấu hình COMPOSIO_API_KEY."));
  let session = sessions.get(userId);
  if (!session) {
    session = createSession(userId).catch((error: unknown) => {
      sessions.delete(userId);
      throw error;
    });
    sessions.set(userId, session);
  }
  return session;
};

/** Gọi API trong Session của user; Session đã hết hạn (404) thì tạo lại đúng một lần. */
const sessionFetch = async (userId: string, path: string, init: RequestInit = {}): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    const session = await getSession(userId);
    const res = await fetch(`${API}/tool_router/session/${encodeURIComponent(session.id)}${path}`, {
      ...init,
      headers: headers(init.body !== undefined),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status !== 404 || attempt > 0) return res;
    await res.arrayBuffer().catch(() => undefined);
    sessions.delete(userId);
  }
};

// ---------- Kết nối ----------

/** Link để người dùng tự đăng nhập app (OAuth do Composio giữ; UniFlow không lưu token của Gmail/Slack). */
export const authorizeApp = async (userId: string, app: ConnectorApp): Promise<string> => {
  const res = await sessionFetch(userId, "/link", { method: "POST", body: JSON.stringify({ toolkit: app }) });
  if (!res.ok) throw new Error(await responseError(res, `Composio link: HTTP ${res.status}`));
  return trustedComposioUrl(z.object({ redirect_url: z.string().optional() }).parse(await res.json()).redirect_url);
};

const toolkitPageSchema = z.object({
  items: z.array(z.object({
    slug: z.string().optional(),
    connected_account: z.object({ id: z.string().optional(), status: z.string().optional() }).nullable().optional(),
  })).optional(),
});

const appAccounts = async (userId: string) => {
  const params = new URLSearchParams({ limit: "50", toolkits: CONNECTOR_APPS.join(",") });
  const res = await sessionFetch(userId, `/toolkits?${params}`);
  if (!res.ok) throw new Error(await responseError(res, `Composio toolkits: HTTP ${res.status}`));
  const items = toolkitPageSchema.parse(await res.json()).items ?? [];
  return Object.fromEntries(
    CONNECTOR_APPS.map((app) => [app, items.find((item) => item.slug?.toLowerCase() === app)?.connected_account ?? null]),
  ) as Record<ConnectorApp, { id?: string; status?: string } | null>;
};

export const connectedApps = async (userId: string): Promise<Record<ConnectorApp, boolean>> => {
  const accounts = await appAccounts(userId);
  return Object.fromEntries(
    CONNECTOR_APPS.map((app) => [app, /^active$/i.test(accounts[app]?.status ?? "")]),
  ) as Record<ConnectorApp, boolean>;
};

/** Thu hồi quyền ở nhà cung cấp rồi xóa kết nối. id lấy từ Session của chính user nên không xóa nhầm của người khác. */
export const disconnectApp = async (userId: string, app: ConnectorApp): Promise<void> => {
  const id = (await appAccounts(userId))[app]?.id;
  if (!id) return;
  const res = await fetch(`${API}/connected_accounts/${encodeURIComponent(id)}?revoke_on_delete=true`, {
    method: "DELETE",
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(await responseError(res, `Composio disconnect: HTTP ${res.status}`));
};

// ---------- Gọi công cụ qua MCP ----------

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/** Câu trả lời JSON-RPC có đúng `id`, từ JSON thường hoặc luồng SSE (`data: {...}`). */
export const parseMcpResponse = (text: string, id: unknown): Record<string, unknown> | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const matches = (value: unknown): value is Record<string, unknown> => {
    const frame = record(value);
    return frame !== undefined && frame.id === id && !("method" in frame) && ("result" in frame || "error" in frame);
  };
  // Lỗi máy chủ không gắn được với yêu cầu (id: null), ví dụ "session not found": vẫn trả lỗi để toolData báo ra.
  const diagnostic = (value: unknown): Record<string, unknown> | null => {
    const frame = record(value);
    if (!frame || frame.id !== null || "method" in frame) return null;
    const error = record(frame.error);
    return typeof error?.message === "string" ? { error } : null;
  };
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
    return matches(parsed) ? parsed : diagnostic(parsed);
  }
  const frames = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown];
      } catch {
        return [];
      }
    });
  return frames.filter(matches).at(-1) ?? frames.map(diagnostic).filter((frame) => frame !== null).at(-1) ?? null;
};

/** `data` của một tool trong câu trả lời tools/call (multi-execute hoặc gọi thẳng). Hình dạng khác là lỗi, không coi là rỗng. */
export const toolData = (slug: string, frame: Record<string, unknown> | null): unknown => {
  if (!frame) throw new Error(`${slug}: no answer`);
  const rpcError = record(frame.error)?.message;
  if (typeof rpcError === "string") throw new Error(rpcError.slice(0, 300));
  const result = record(frame.result);
  const parts = Array.isArray(result?.content) ? result.content : [];
  const text = parts.map(record).find((part) => typeof part?.text === "string")?.text as string | undefined;
  if (result?.isError === true) throw new Error(text?.slice(0, 300) || `${slug} failed`);
  if (text === undefined) throw new Error(`${slug}: the answer had no text`);
  let body: Record<string, unknown> | undefined;
  try {
    body = record(JSON.parse(text));
  } catch {
    throw new Error(`${slug}: the answer was not JSON`);
  }
  if (!body) throw new Error(`${slug}: the answer was not an object`);
  if (body.successful === false) throw new Error(String(body.error ?? `${slug} failed`).slice(0, 300));
  const results = record(body.data)?.results;
  if (Array.isArray(results)) {
    const response = record(results.map(record).find((item) => item?.tool_slug === slug)?.response);
    if (!response) throw new Error(`${slug}: missing from the answer`);
    if (response.successful === false) throw new Error(String(response.error ?? `${slug} failed`).slice(0, 300));
    if (!("data" in response)) throw new Error(`${slug}: the answer had no data`);
    return response.data;
  }
  if (!("data" in body)) throw new Error(`${slug}: the answer had no data`);
  return body.data;
};

const mcpPost = (url: string, payload: unknown, transport?: string) => {
  const mcpHeaders = headers(true);
  mcpHeaders.set("accept", "application/json, text/event-stream");
  if (transport) mcpHeaders.set("mcp-session-id", transport);
  return fetch(url, { method: "POST", headers: mcpHeaders, body: JSON.stringify(payload), signal: AbortSignal.timeout(45_000) });
};

/** Chạy một công cụ ĐỌC của app đã kết nối, dưới danh nghĩa `userId`. */
export const callAppTool = async (userId: string, slug: string, args: Record<string, unknown>): Promise<unknown> => {
  if (!ALLOWED_TOOLS.has(slug)) throw new Error(`Công cụ ${slug} không được phép.`);
  const { mcpUrl } = await getSession(userId);

  const init = await mcpPost(mcpUrl, {
    jsonrpc: "2.0", id: "uf-init", method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "uniflow", version: "1" } },
  });
  if (!init.ok) {
    if (init.status === 404) sessions.delete(userId);
    throw new Error(`Composio MCP: HTTP ${init.status}`);
  }
  await init.arrayBuffer();
  const transport = init.headers.get("mcp-session-id") ?? undefined;
  // MCP streamable-HTTP cần thông báo initialized trước yêu cầu đầu tiên.
  await mcpPost(mcpUrl, { jsonrpc: "2.0", method: "notifications/initialized" }, transport).then((res) => res.arrayBuffer()).catch(() => undefined);

  const answer = await mcpPost(mcpUrl, {
    jsonrpc: "2.0", id: CALL_ID, method: "tools/call",
    params: { name: MULTI_EXECUTE, arguments: { tools: [{ tool_slug: slug, arguments: args }] } },
  }, transport);
  if (!answer.ok) {
    if (answer.status === 404) sessions.delete(userId);
    throw new Error(`${slug}: HTTP ${answer.status}`);
  }
  if (Number(answer.headers.get("content-length") ?? "0") > MAX_ANSWER_BYTES) throw new Error(`${slug}: câu trả lời quá lớn`);
  const bytes = await answer.arrayBuffer();
  if (bytes.byteLength > MAX_ANSWER_BYTES) throw new Error(`${slug}: câu trả lời quá lớn`);
  return toolData(slug, parseMcpResponse(new TextDecoder().decode(bytes), CALL_ID));
};

// ---------- Parser Gmail ----------

export type EmailHeader = { id: string; threadId: string; at: number; from: string; subject: string; preview: string };

const PREVIEW_MAX = 300;
const flat = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

const headerValue = (item: Record<string, unknown>, name: string): string | undefined => {
  const list = record(item.payload)?.headers;
  const value = (Array.isArray(list) ? list : []).map(record)
    .find((header) => typeof header?.name === "string" && header.name.toLowerCase() === name)?.value;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const sentAt = (item: Record<string, unknown>): number => {
  const at = typeof item.messageTimestamp === "string" ? Date.parse(item.messageTimestamp)
    : typeof item.internalDate === "string" || typeof item.internalDate === "number" ? Number(item.internalDate) : Number.NaN;
  return Number.isFinite(at) ? at : 0;
};

const emailHeader = (raw: unknown): EmailHeader | null => {
  const item = record(raw);
  const id = typeof item?.messageId === "string" && item.messageId ? item.messageId : typeof item?.id === "string" ? item.id : "";
  if (!item || !id) return null;
  const preview = record(item.preview);
  return {
    id,
    threadId: typeof item.threadId === "string" && item.threadId ? item.threadId : id,
    at: sentAt(item),
    from: flat(item.sender ?? item.from ?? headerValue(item, "from")).slice(0, PREVIEW_MAX),
    subject: flat(item.subject ?? preview?.subject ?? headerValue(item, "subject")).slice(0, PREVIEW_MAX),
    preview: flat(preview?.body ?? item.snippet ?? item.messageText).slice(0, PREVIEW_MAX),
  };
};

export const emailsFromData = (data: unknown): EmailHeader[] => {
  const list = Array.isArray(data) ? data
    : [record(data), record(record(data)?.response_data)].map((body) => body?.messages).find(Array.isArray);
  if (!list) throw new Error("the Gmail answer had no message list");
  const result = (list as unknown[]).flatMap((raw) => emailHeader(raw) ?? []);
  if (list.length > 0 && result.length === 0) throw new Error("none of the Gmail messages could be read");
  return result;
};

type GmailPart = { mimeType?: unknown; body?: { data?: unknown }; parts?: unknown };

const gmailPartText = (part: GmailPart | undefined, mime: string): string => {
  if (!part) return "";
  if (part.mimeType === mime && typeof part.body?.data === "string") return Buffer.from(part.body.data, "base64url").toString("utf8");
  return (Array.isArray(part.parts) ? (part.parts as GmailPart[]) : []).map((child) => gmailPartText(child, mime)).filter(Boolean).join("\n");
};

/** Tiêu đề + thân thư (text/plain trước, HTML thì bỏ thẻ). */
export const emailFromData = (data: unknown): EmailHeader & { body: string } => {
  const top = record(data);
  const item = record(top?.message) ?? record(top?.response_data) ?? top;
  const header = emailHeader(item);
  if (!item || !header) throw new Error("the Gmail message could not be read");
  const payload = record(item.payload) as GmailPart | undefined;
  const body = gmailPartText(payload, "text/plain")
    || gmailPartText(payload, "text/html").replace(/<[^>]+>/g, " ")
    || (typeof item.messageText === "string" ? item.messageText : "");
  return { ...header, body: body.replace(/[ \t]+/g, " ").trim() };
};
