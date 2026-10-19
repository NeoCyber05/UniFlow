import { z } from "zod";

export const CAPTURE_SELECTION_MAX_LENGTH = 4_000;
export const CAPTURE_PAGE_TITLE_MAX_LENGTH = 200;
export const CAPTURE_URL_MAX_LENGTH = 2_048;
export const CAPTURE_DESCRIPTION_MAX_LENGTH = 3_000;
export const CAPTURE_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Adapter đã khảo sát và chứng minh lấy được thời điểm gửi thật của tin nhắn.
 * MVP chưa có adapter nào (plan Task 1/7), nên messageSentAt luôn bị bỏ.
 */
export const VERIFIED_TIMESTAMP_ADAPTERS: ReadonlySet<string> = new Set();

/** Query key được giữ lại trong URL nguồn; rỗng = bỏ toàn bộ query. */
const QUERY_ALLOWLIST: ReadonlySet<string> = new Set();

export const isValidTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** Chỉ http/https; bỏ credentials, fragment và query ngoài allowlist. null = URL không an toàn. */
export const sanitizeCaptureUrl = (value: string): string | null => {
  if (value.length > CAPTURE_URL_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (!QUERY_ALLOWLIST.has(key)) url.searchParams.delete(key);
  }
  const result = url.toString();
  return result.length > CAPTURE_URL_MAX_LENGTH ? null : result;
};

const SafeUrl = z.string().transform((value, ctx) => {
  const url = sanitizeCaptureUrl(value.trim());
  if (!url) {
    ctx.addIssue({ code: "custom", message: "Liên kết nguồn không hợp lệ." });
    return z.NEVER;
  }
  return url;
});

const IsoInstant = z.string().datetime({ offset: true });

export const CaptureSourceSchema = z.object({
  selectedText: z.string()
    .transform((value) => value.replace(/\r\n/g, "\n").trim())
    .pipe(z.string()
      .min(1, { message: "Đoạn chọn trống." })
      .max(CAPTURE_SELECTION_MAX_LENGTH, { message: "Đoạn chọn quá dài. Vui lòng rút gọn tối đa 4000 ký tự." })),
  pageUrl: z.optional(z.union([SafeUrl, z.null()])),
  pageTitle: z.optional(z.union([
    z.string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().max(CAPTURE_PAGE_TITLE_MAX_LENGTH, { message: "Tiêu đề trang tối đa 200 ký tự." })),
    z.null(),
  ])),
  messagePermalink: z.optional(z.union([SafeUrl, z.null()])),
  messageSentAt: z.optional(z.union([IsoInstant, z.null()])),
  /** Adapter cung cấp messageSentAt/messagePermalink; chỉ adapter đã kiểm chứng mới được tin. */
  adapter: z.optional(z.union([z.string().max(64), z.null()])),
  capturedAt: IsoInstant,
  timeZone: z.string().refine(isValidTimeZone, { message: "Múi giờ không hợp lệ." }),
});

export type CaptureSource = {
  selectedText: string;
  pageUrl: string | null;
  pageTitle: string | null;
  messagePermalink: string | null;
  messageSentAt: string | null;
  capturedAt: string;
  timeZone: string;
};

export class CaptureSourceError extends Error {}

/**
 * Chuẩn hóa nguồn từ trang ngoài. Thời điểm gửi và permalink chỉ được giữ khi adapter đã kiểm chứng
 * cung cấp; không bao giờ suy từ capturedAt hay pageUrl.
 */
export const normalizeCaptureSource = (
  input: unknown,
  { verifiedAdapters = VERIFIED_TIMESTAMP_ADAPTERS }: { verifiedAdapters?: ReadonlySet<string> } = {},
): CaptureSource => {
  const parsed = CaptureSourceSchema.safeParse(input);
  if (!parsed.success) {
    throw new CaptureSourceError(parsed.error.issues[0]?.message ?? "Nguồn không hợp lệ.");
  }
  const value = parsed.data;
  const verified = Boolean(value.adapter && verifiedAdapters.has(value.adapter));
  return {
    selectedText: value.selectedText,
    pageUrl: value.pageUrl ?? null,
    pageTitle: value.pageTitle || null,
    messagePermalink: verified ? value.messagePermalink ?? null : null,
    messageSentAt: verified && value.messageSentAt ? new Date(value.messageSentAt).toISOString() : null,
    capturedAt: new Date(value.capturedAt).toISOString(),
    timeZone: value.timeZone,
  };
};

/** Mốc cho "hôm nay/ngày mai": thời điểm gửi tin đã kiểm chứng; thiếu thì người dùng phải xác nhận ngày tuyệt đối. */
export const getCaptureTimeContext = (source: CaptureSource) => ({
  referenceIso: source.messageSentAt ?? source.capturedAt,
  requiresRelativeDateConfirmation: !source.messageSentAt,
});

export const getCaptureSourceLabel = (source: Pick<CaptureSource, "messagePermalink">) =>
  source.messagePermalink ? "Tin nhắn gốc" : "Trang nguồn";

const MARKDOWN_SPECIAL = /[\\`*_{}[\]()<>#+\-.!|~]/g;

/** Văn bản thuần → Markdown hiển thị đúng chữ, không tạo link/HTML. */
export const escapeMarkdown = (value: string) => value.replace(MARKDOWN_SPECIAL, (char) => `\\${char}`);

/** Đoạn mô tả có nhãn rõ chứa trích đoạn và nguồn; không truncate âm thầm. */
export const buildCaptureSourceDescription = (source: CaptureSource) => {
  const quote = source.selectedText
    .split("\n")
    .map((line) => `> ${escapeMarkdown(line)}`)
    .join("\n");
  const lines = ["**Trích đoạn nguồn**", "", quote];
  const link = source.messagePermalink ?? source.pageUrl;
  if (link) {
    const title = source.pageTitle ? `${escapeMarkdown(source.pageTitle)} — ` : "";
    lines.push("", `${getCaptureSourceLabel(source)}: ${title}<${link}>`);
  } else if (source.pageTitle) {
    lines.push("", `${getCaptureSourceLabel(source)}: ${escapeMarkdown(source.pageTitle)}`);
  }
  return lines.join("\n");
};

export const getCaptureDescriptionError = (description: string) =>
  description.length > CAPTURE_DESCRIPTION_MAX_LENGTH
    ? "Mô tả kèm nguồn vượt 3000 ký tự. Hãy rút gọn đoạn chọn hoặc bỏ đính kèm nguồn."
    : null;

const LINK_TARGETS = [/\]\(\s*<?([^)\s>]*)/g, /<([a-z][a-z0-9+.-]*:[^>\s]*)>/gi, /^\s*\[[^\]]+\]:\s*<?(\S+?)>?\s*$/gm];

/** Link Markdown (inline, autolink, reference) có scheme khác http/https/mailto. */
export const hasUnsafeMarkdownLink = (value: string) =>
  LINK_TARGETS.some((pattern) =>
    Array.from(value.matchAll(pattern)).some((match) => {
      const target = match[1].trim().toLowerCase().replace(/[\u0000- ]/g, "");
      const scheme = target.match(/^([a-z][a-z0-9+.-]*):/)?.[1];
      return Boolean(scheme) && !["http", "https", "mailto"].includes(scheme!);
    }),
  );
