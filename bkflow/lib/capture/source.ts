import { z } from "zod";

export const CAPTURE_TEXT_MAX_LENGTH = 4_000;
const PAGE_TITLE_MAX_LENGTH = 200;
const URL_MAX_LENGTH = 2_048;

export const isValidTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** http(s) only, no credentials, no fragment, no query (shortcut: no query allowlist yet, add one when an adapter needs a permalink param). */
export const sanitizeSourceUrl = (value: string | null | undefined): string | null => {
  if (!value || value.length > URL_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
};

const OptionalUrl = z.optional(z.union([z.string(), z.null()])).transform((value) => sanitizeSourceUrl(value) ?? undefined);

export const CaptureSourceSchema = z.object({
  selectedText: z.string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(CAPTURE_TEXT_MAX_LENGTH)),
  pageUrl: OptionalUrl,
  pageTitle: z.optional(z.string().transform((value) => value.replace(/\s+/g, " ").trim()).pipe(z.string().max(PAGE_TITLE_MAX_LENGTH))),
  /** Only an adapter verified in the Q3 survey may set this; never derived from the page URL. */
  messagePermalink: OptionalUrl,
  /** Verified message timestamp from such an adapter; never inferred from capturedAt. */
  messageSentAt: z.optional(z.string().datetime({ offset: true })),
  capturedAt: z.string().datetime({ offset: true }),
  timeZone: z.string().refine(isValidTimeZone, { message: "Múi giờ không hợp lệ." }),
});

export type CaptureSource = z.output<typeof CaptureSourceSchema>;

export const normalizeCaptureSource = (input: unknown): CaptureSource => CaptureSourceSchema.parse(input);

export const getCaptureTimeContext = (source: CaptureSource) => ({
  referenceIso: new Date(source.messageSentAt ?? source.capturedAt).toISOString(),
  requiresRelativeDateConfirmation: !source.messageSentAt,
});

// Snippets come from other sites: escape HTML and Markdown so links/markup stay inert text.
const escapeText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`/g, "'")
    .replace(/([\\[\]()*_#|~])/g, "\\$1");

export const formatInZone = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

/** Description block for a captured task: quoted snippet + labelled source. Not truncated; the caller checks length. */
export const formatSourceDescription = (source: CaptureSource) => {
  const quote = escapeText(source.selectedText).split(/\r?\n/).map((line) => `> ${line}`).join("\n");
  const lines = ["**Trích đoạn**", quote, ""];
  if (source.messagePermalink) lines.push(`Tin nhắn gốc: ${source.messagePermalink}`);
  else if (source.pageUrl) lines.push(`Trang nguồn: ${source.pageUrl}`);
  if (source.pageTitle) lines.push(`Tiêu đề trang: ${escapeText(source.pageTitle)}`);
  if (source.messageSentAt) lines.push(`Gửi lúc: ${formatInZone(source.messageSentAt, source.timeZone)}`);
  return lines.join("\n").trim();
};
