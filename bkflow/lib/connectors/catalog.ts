// Danh mục ứng dụng (metadata) từ Composio, chỉ đọc. Ý tưởng listToolkits từ OpenMausBot (Apache-2.0).
// Capability lấy từ CONNECTOR_APPS (app có công cụ đọc thật), không suy từ việc vendor hỗ trợ OAuth.
import "server-only";

import { CONNECTOR_APPS, isConnectorApp } from "@/lib/connectors/composio";
import type { ConnectorCatalog, ConnectorCatalogItem } from "@/lib/connectors/catalog-shared";

const TOOLKITS_URL = "https://backend.composio.dev/api/v3/toolkits";
const DEADLINE_MS = 30_000;
const MAX_PAGES = 10;
const CACHE_MS = 10 * 60_000;
const DESCRIPTION_MAX = 160;
const SLUG = /^[a-z0-9_-]{1,80}$/;

const FALLBACK: ConnectorCatalogItem[] = [
  ["gmail", "Gmail", "Đọc email để tìm việc cần làm."],
  ["slack", "Slack", "Tìm tin nhắn có việc được giao."],
  ["googlecalendar", "Google Calendar", "Lịch và sự kiện."],
  ["googledrive", "Google Drive", "Tệp và thư mục."],
  ["notion", "Notion", "Trang và cơ sở dữ liệu."],
  ["github", "GitHub", "Issue và pull request."],
  ["linear", "Linear", "Issue và dự án."],
  ["jira", "Jira", "Issue và sprint."],
].map(([slug, name, description]) => ({ slug, name, description, logoUrl: null, taskReadSupported: isConnectorApp(slug) }));

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const safeLogo = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Chuẩn hóa item Composio thành thẻ an toàn để render (text thuần, logo chỉ https). */
export const normalizeCatalogItems = (items: unknown[]): ConnectorCatalogItem[] => {
  const seen = new Set<string>();
  const result: ConnectorCatalogItem[] = [];
  for (const raw of items) {
    const item = record(raw);
    const slug = typeof item?.slug === "string" ? item.slug.trim().toLowerCase() : "";
    if (!item || !SLUG.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    const meta = record(item.meta);
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 80) : slug;
    const description = typeof meta?.description === "string" ? meta.description.replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_MAX) : "";
    result.push({ slug, name, description, logoUrl: safeLogo(meta?.logo), taskReadSupported: isConnectorApp(slug) });
  }
  return result;
};

/** API có thể bỏ sót Gmail/Slack: luôn giữ chỗ cho app có adapter để inventory không mất nơi hiển thị. */
const withSupported = (items: ConnectorCatalogItem[]) => [
  ...items,
  ...FALLBACK.filter((app) => (CONNECTOR_APPS as readonly string[]).includes(app.slug) && !items.some((x) => x.slug === app.slug)),
];

let cache: { key: string; at: number; value: ConnectorCatalog } | null = null;

export const loadConnectorCatalog = async (): Promise<ConnectorCatalog> => {
  const key = process.env.COMPOSIO_API_KEY?.trim();
  if (!key) return { items: FALLBACK, source: "fallback", complete: false };
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.value;

  const signal = AbortSignal.timeout(DEADLINE_MS);
  const raw: unknown[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  let complete = false;
  for (let pageNo = 0; pageNo < MAX_PAGES; pageNo++) {
    const params = new URLSearchParams({ limit: "500", sort_by: "usage" });
    if (cursor) params.set("cursor", cursor);
    try {
      const res = await fetch(`${TOOLKITS_URL}?${params}`, { headers: { "x-api-key": key }, signal });
      if (!res.ok) break;
      const body = record(await res.json());
      if (!Array.isArray(body?.items)) break;
      raw.push(...body.items);
      const next = typeof body.next_cursor === "string" && body.next_cursor ? body.next_cursor : null;
      if (!next) { complete = true; break; }
      if (cursors.has(next)) break;
      cursors.add(next);
      cursor = next;
    } catch {
      break;
    }
  }

  const items = normalizeCatalogItems(raw);
  if (items.length === 0) return { items: FALLBACK, source: "fallback", complete: false };
  const value: ConnectorCatalog = { items: withSupported(items), source: "composio", complete };
  // Chỉ cache bản đầy đủ để Retry thật sự thử lại khi partial/lỗi.
  if (complete) cache = { key, at: Date.now(), value };
  return value;
};
